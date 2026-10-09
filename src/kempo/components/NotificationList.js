import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Pagination.js';
import { getNotifications, markNotificationRead, markNotificationHandled, dismissNotification } from '/kempo/sdk.js';

/*
  Presentation of a notification's level
*/

const LEVELS = {
  info: { icon: 'info', color: 'tc-primary' },
  success: { icon: 'check_circle', color: 'tc-success' },
  warning: { icon: 'warning', color: 'tc-warning' },
  error: { icon: 'error', color: 'tc-danger' }
};

const API_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/*
  The server refuses anything else when a notification is created. It is checked again here because the
  list renders whatever the API returns, and a link that is not a path on this site must never be followed.
*/
const isLocalPath = value => typeof value === 'string' && /^\/(?![/\\])[^\\\s\u0000-\u001f\u007f]*$/.test(value);

const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const relativeTime = value => {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const [unit, size] = units.find(([, size]) => Math.abs(seconds) >= size) || ['second', 1];
  return Math.abs(seconds) < 45 ? 'just now' : relativeFormat.format(Math.round(seconds / size), unit);
};

/*
  Renders one signed-in user's notifications: level icon, title, message, relative time, the actions the
  sender attached, and controls to mark one read or dismiss it. Title and message are rendered as text,
  never as HTML.

  Attributes: `unread-only`, `page-size` (default 20), `paginated` (adds page controls), `compact`
  (tighter rows for a dropdown). Call `refresh()` to reload. Fires `notifications-change` with
  `{ unread, total }` after every load or change, which is how a bell keeps its badge current.
*/
export default class NotificationList extends LightComponent {
  static properties = {
    unreadOnly: { type: Boolean, attribute: 'unread-only', reflect: true },
    pageSize: { type: Number, attribute: 'page-size' },
    paginated: { type: Boolean, reflect: true },
    compact: { type: Boolean, reflect: true },
    notifications: { state: true },
    total: { state: true },
    page: { state: true },
    loading: { state: true },
    failure: { state: true },
    busy: { state: true },
    rowErrors: { state: true }
  };

  constructor(){
    super();
    this.unreadOnly = false;
    this.pageSize = 20;
    this.paginated = false;
    this.compact = false;
    this.notifications = [];
    this.total = 0;
    this.page = 1;
    this.loading = true;
    this.failure = '';
    this.busy = new Set();
    this.rowErrors = {};
  }

  /*
    Lifecycle Callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    this.refresh();
  }

  updated(changed){
    super.updated(changed);
    if(changed.has('unreadOnly') && changed.get('unreadOnly') !== undefined){
      this.page = 1;
      this.refresh();
    }
  }

  /*
    Public Methods
  */

  refresh = async () => {
    const [error, data] = await getNotifications({ unreadOnly: this.unreadOnly, limit: this.pageSize, offset: (this.page - 1) * this.pageSize });
    this.loading = false;

    if(error){
      this.failure = error.code === 401 ? 'Sign in to see your notifications.' : `Could not load notifications: ${error.msg}`;
      return;
    }

    if(!data.notifications.length && this.page > 1){
      this.page = Math.max(Math.ceil(data.total / this.pageSize), 1);
      return this.refresh();
    }

    this.failure = '';
    this.notifications = data.notifications;
    this.total = data.total;
    this.dispatchEvent(new CustomEvent('notifications-change', { bubbles: true, detail: { unread: data.unread, total: data.total } }));
  };

  /*
    Event Handlers
  */

  handlePageChange = event => {
    if(event.detail.currentPage === this.page) return;
    this.page = event.detail.currentPage;
    this.refresh();
  };

  run = async (id, task) => {
    this.busy = new Set(this.busy).add(id);
    this.rowErrors = { ...this.rowErrors, [id]: '' };
    const error = await task();
    if(error) this.rowErrors = { ...this.rowErrors, [id]: error };
    const busy = new Set(this.busy);
    busy.delete(id);
    this.busy = busy;
    await this.refresh();
  };

  read = item => this.run(item.id, async () => (await markNotificationRead(item.id))[0]?.msg);

  dismiss = item => this.run(item.id, async () => (await dismissNotification(item.id))[0]?.msg);

  follow = (event, item, action) => {
    event.preventDefault();
    this.run(item.id, async () => {
      await markNotificationRead(item.id);
      window.location.href = action.href;
    });
  };

  /*
    The request is made by this browser with the signed-in user's own session, so the endpoint it names
    applies its own permission checks to that user. Only a response that succeeded marks it handled.
  */
  call = (item, action) => this.run(item.id, async () => {
    const { method, url, body } = action.api;
    let response;
    try {
      response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      return `${action.label} failed: the request could not be sent`;
    }
    if(!response.ok){
      const detail = await response.json().catch(() => ({}));
      return `${action.label} failed: ${detail.error || detail.message || response.status}`;
    }
    const [error] = await markNotificationHandled(item.id);
    return error?.msg;
  });

  /*
    Rendering
  */

  renderAction = (item, action) => {
    const disabled = this.busy.has(item.id);
    if(action.href !== undefined){
      return isLocalPath(action.href)
        ? html`<a class="btn mr" href=${action.href} @click=${event => this.follow(event, item, action)}>${action.label}</a>`
        : nothing;
    }
    if(action.api && API_METHODS.includes(action.api.method) && isLocalPath(action.api.url)){
      return html`<button class="primary mr" ?disabled=${disabled} @click=${() => this.call(item, action)}>${action.label}</button>`;
    }
    return nothing;
  };

  renderItem = item => {
    const level = LEVELS[item.level] || LEVELS.info;
    const unread = !item.readAt;
    const disabled = this.busy.has(item.id);
    return html`
      <div class="d-f py b-bottom ${this.compact ? 'px' : 'pxh'} ${unread ? 'bg-alt' : ''}" data-notification-id=${item.id} data-unread=${unread}>
        <k-icon class="${level.color} mr" name=${level.icon}></k-icon>
        <div class="flex">
          <div><strong class=${unread ? '' : 'tc-muted'}>${item.title}</strong> <span class="small tc-muted">${relativeTime(item.updatedAt)}</span></div>
          ${item.message ? html`<div class="mtq">${item.message}</div>` : nothing}
          ${item.handledAt
            ? html`<div class="small tc-muted mtq">Done ${relativeTime(item.handledAt)}</div>`
            : item.actions?.length ? html`<div class="mth">${item.actions.map(action => this.renderAction(item, action))}</div>` : nothing}
          ${this.rowErrors[item.id] ? html`<div class="tc-danger mtq" role="alert">${this.rowErrors[item.id]}</div>` : nothing}
        </div>
        <div class="d-f">
          ${unread ? html`<button class="no-btn pq" title="Mark as read" aria-label="Mark as read" ?disabled=${disabled} @click=${() => this.read(item)}><k-icon name="check"></k-icon></button>` : nothing}
          <button class="no-btn pq" title="Dismiss" aria-label="Dismiss" ?disabled=${disabled} @click=${() => this.dismiss(item)}><k-icon name="close"></k-icon></button>
        </div>
      </div>
    `;
  };

  renderLightDom(){
    if(this.failure) return html`<p class="p tc-muted">${this.failure}</p>`;
    if(this.loading) return html`<p class="p tc-muted">Loading&hellip;</p>`;
    if(!this.notifications.length) return html`<p class="p tc-muted">${this.unreadOnly ? 'No unread notifications.' : 'No notifications.'}</p>`;
    return html`
      <div>${this.notifications.map(this.renderItem)}</div>
      ${this.paginated && this.total > this.pageSize ? html`
        <k-pagination class="d-b my" controls="simple" .page=${this.page} .totalItems=${this.total} .itemsPerPage=${this.pageSize} @page-change=${this.handlePageChange}></k-pagination>
      ` : nothing}
    `;
  }
}

customElements.define('k-notification-list', NotificationList);
