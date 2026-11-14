import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Dropdown.js';
import '/kempo-ui/components/Icon.js';
import './NotificationList.js';
import { onNoticeCount } from '/kempo/notifications/client.js';
import { markAllNotificationsViewed } from '/kempo/sdk.js';

const VIEWED_AFTER_MS = 1000;

/*
  A bell with a badge of the notices a person has not viewed, which opens the notices. It is the one element a site needs
  to show a person their notices, signed in or a guest; it renders nothing until the server has answered and nothing
  at all when there is no one to answer for.

  The count comes from the notification client (see notifications/client.js), which asks the server on the
  `system:notification_poll_seconds` schedule, so the bell has no timer of its own. Opening the bell shows the notices,
  and one second later the ones on screen count as viewed.

  Attributes: `page-href` (a "View all" link to a full history page, hidden when unset), `open-direction` (passed to the
  dropdown) and `button-class` (extra classes for the trigger button, for example to size it like the surrounding controls).
*/
export default class NotificationBell extends LightComponent {
  static properties = {
    pageHref: { type: String, attribute: 'page-href' },
    openDirection: { type: String, attribute: 'open-direction' },
    buttonClass: { type: String, attribute: 'button-class' },
    count: { state: true }
  };

  #stop = null;
  #viewTimer = null;

  constructor(){
    super();
    this.pageHref = '';
    this.openDirection = 'down right';
    this.buttonClass = '';
    this.count = null;
  }

  /*
    Lifecycle Callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    this.#stop = onNoticeCount(count => { this.count = count; });
  }

  disconnectedCallback(){
    super.disconnectedCallback();
    this.#stop?.();
    clearTimeout(this.#viewTimer);
  }

  /*
    Event Handlers
  */

  handleOpened = event => {
    if(event.target.closest('k-notification-bell') !== this) return;
    const list = this.querySelector('k-notification-list');
    list?.refresh();
    clearTimeout(this.#viewTimer);
    this.#viewTimer = setTimeout(() => list?.viewVisible(), VIEWED_AFTER_MS);
  };

  handleClosed = event => {
    if(event.target.closest('k-notification-bell') !== this) return;
    clearTimeout(this.#viewTimer);
  };

  handleChange = event => {
    this.count = event.detail.unread;
  };

  markAll = async () => {
    await markAllNotificationsViewed({ type: 'notice' });
    await this.querySelector('k-notification-list')?.refresh();
  };

  /*
    Rendering
  */

  renderLightDom(){
    if(this.count === null) return nothing;
    return html`
      <k-dropdown close-on-select="false" open-direction=${this.openDirection} @opened=${this.handleOpened} @closed=${this.handleClosed}>
        <button slot="trigger" class="no-btn d-f ${this.buttonClass}" aria-label=${this.count ? `Notifications, ${this.count} unread` : 'Notifications'}>
          <k-icon name="notifications"></k-icon>
          ${this.count ? html`<span class="bg-danger round pxh ml" data-unread-badge>${this.count > 99 ? '99+' : this.count}</span>` : nothing}
        </button>
        <div @notifications-change=${this.handleChange}>
          <div class="d-f p b-bottom">
            <strong class="flex">Notifications</strong>
            <button class="link" ?disabled=${!this.count} @click=${this.markAll}>Mark all read</button>
          </div>
          <k-notification-list type="notice" compact page-size="8"></k-notification-list>
          ${this.pageHref ? html`<div class="ta-center p"><a href=${this.pageHref}>View all</a></div>` : nothing}
        </div>
      </k-dropdown>
    `;
  }
}

customElements.define('k-notification-bell', NotificationBell);
