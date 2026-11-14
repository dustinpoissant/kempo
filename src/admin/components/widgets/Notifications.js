import DashboardWidget from '/kempo/components/DashboardWidget.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo/components/NotificationList.js';
import { markAllNotificationsViewed } from '/kempo/sdk.js';

/*
  The signed-in user's unread notices. The list loads itself, so this widget has nothing to fetch.
*/
export default class NotificationsWidget extends DashboardWidget {
  constructor(){
    super();
    this.cta = { label: 'Mark all read', icon: 'done_all', onClick: () => this.markAllRead() };
  }

  /*
    Event Handlers
  */

  markAllRead = async () => {
    await markAllNotificationsViewed({ type: 'notice' });
    await this.querySelector('k-notification-list')?.refresh();
  };

  /*
    Rendering
  */

  renderContent(){
    return html`
      <k-notification-list type="notice" compact unread-only page-size=${this.height * 3}></k-notification-list>
    `;
  }
}

customElements.define('k-widget-notifications', NotificationsWidget);
