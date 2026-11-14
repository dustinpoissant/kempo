import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import './NotificationList.js';

const TYPES = [
  ['', 'Everything'],
  ['notice', 'Notices'],
  ['toast', 'Toasts'],
  ['banner', 'Banners'],
  ['modal', 'Pop-ups'],
  ['inline', 'In-page messages']
];

const STATUSES = [
  ['all', 'All, including dismissed'],
  ['active', 'Still active'],
  ['viewed', 'Viewed'],
  ['acknowledged', 'Acknowledged'],
  ['dismissed', 'Dismissed'],
  ['expired', 'Expired']
];

/*
  A person's notification history, signed in or a guest: every notification they were sent, the ones they dismissed
  included, until the site's retention removes it, with a choice of kind and status. A dismissed one can still be read
  here the next day.

  Attributes: `type` and `status` (what it starts on; `all` by default) and `page-size` (default 20).
*/
export default class NotificationHistory extends LightComponent {
  static properties = {
    type: { type: String, reflect: true },
    status: { type: String, reflect: true },
    pageSize: { type: Number, attribute: 'page-size' }
  };

  constructor(){
    super();
    this.type = '';
    this.status = 'all';
    this.pageSize = 20;
  }

  /*
    Event Handlers
  */

  changeType = event => {
    this.type = event.target.value;
  };

  changeStatus = event => {
    this.status = event.target.value;
  };

  /*
    Rendering
  */

  renderLightDom(){
    return html`
      <div class="d-f mb">
        <div class="mr">
          <label class="d-b mbq" for="notification-history-type">Kind</label>
          <select id="notification-history-type" @change=${this.changeType}>
            ${TYPES.map(([value, label]) => html`<option value=${value} ?selected=${this.type === value}>${label}</option>`)}
          </select>
        </div>
        <div>
          <label class="d-b mbq" for="notification-history-status">Status</label>
          <select id="notification-history-status" @change=${this.changeStatus}>
            ${STATUSES.map(([value, label]) => html`<option value=${value} ?selected=${this.status === value}>${label}</option>`)}
          </select>
        </div>
      </div>
      <k-notification-list show-status paginated .type=${this.type} .status=${this.status} .pageSize=${this.pageSize}></k-notification-list>
    `;
  }
}

customElements.define('k-notification-history', NotificationHistory);
