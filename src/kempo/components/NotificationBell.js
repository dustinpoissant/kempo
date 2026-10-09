import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Dropdown.js';
import '/kempo-ui/components/Icon.js';
import './NotificationList.js';
import { getUnreadNotificationCount, markAllNotificationsRead } from '/kempo/sdk.js';

/*
  A bell with an unread badge that opens the latest notifications. It is the one element a site needs to
  show a signed-in user their notifications; it renders nothing when nobody is signed in.

  Attributes: `page-href` (a "View all" link to a full notifications page, hidden when unset),
  `interval` (milliseconds between background checks of the count, default 60000, 0 to turn them off) and
  `open-direction` (passed to the dropdown). The count is also refreshed on load, when the window regains
  focus and whenever the panel opens.
*/
export default class NotificationBell extends LightComponent {
  static properties = {
    pageHref: { type: String, attribute: 'page-href' },
    interval: { type: Number },
    openDirection: { type: String, attribute: 'open-direction' },
    count: { state: true },
    signedOut: { state: true }
  };

  #timer = null;

  constructor(){
    super();
    this.pageHref = '';
    this.interval = 60000;
    this.openDirection = 'down right';
    this.count = 0;
    this.signedOut = false;
  }

  /*
    Lifecycle Callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    window.addEventListener('focus', this.refreshCount);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.refreshCount();
    if(this.interval > 0) this.#timer = setInterval(this.handleTick, this.interval);
  }

  disconnectedCallback(){
    super.disconnectedCallback();
    window.removeEventListener('focus', this.refreshCount);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    clearInterval(this.#timer);
  }

  /*
    Public Methods
  */

  refreshCount = async () => {
    const [error, data] = await getUnreadNotificationCount();
    if(error){
      this.signedOut = error.code === 401;
      if(this.signedOut) this.count = 0;
      return;
    }
    this.signedOut = false;
    this.count = data.count;
  };

  /*
    Event Handlers
  */

  handleTick = () => {
    if(!document.hidden) this.refreshCount();
  };

  handleVisibility = () => {
    if(!document.hidden) this.refreshCount();
  };

  handleOpened = event => {
    if(event.target.closest('k-notification-bell') !== this) return;
    this.querySelector('k-notification-list')?.refresh();
    this.refreshCount();
  };

  handleChange = event => {
    this.count = event.detail.unread;
  };

  markAll = async () => {
    await markAllNotificationsRead();
    await this.querySelector('k-notification-list')?.refresh();
  };

  /*
    Rendering
  */

  renderLightDom(){
    if(this.signedOut) return nothing;
    return html`
      <k-dropdown close-on-select="false" open-direction=${this.openDirection} @opened=${this.handleOpened}>
        <button slot="trigger" class="no-btn d-f" aria-label=${this.count ? `Notifications, ${this.count} unread` : 'Notifications'}>
          <k-icon name="notifications"></k-icon>
          ${this.count ? html`<span class="bg-danger round pxh ml" data-unread-badge>${this.count > 99 ? '99+' : this.count}</span>` : nothing}
        </button>
        <div @notifications-change=${this.handleChange}>
          <div class="d-f p b-bottom">
            <strong class="flex">Notifications</strong>
            <button class="link" ?disabled=${!this.count} @click=${this.markAll}>Mark all read</button>
          </div>
          <k-notification-list compact page-size="8"></k-notification-list>
          ${this.pageHref ? html`<div class="ta-center p"><a href=${this.pageHref}>View all</a></div>` : nothing}
        </div>
      </k-dropdown>
    `;
  }
}

customElements.define('k-notification-bell', NotificationBell);
