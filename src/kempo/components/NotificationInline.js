import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';
import { subscribe, getSettings } from '/kempo/notifications/client.js';

const COLORS = { success: 'bg-success', warning: 'bg-warning', error: 'bg-danger' };

/*
  Where `inline` notifications appear: place it in a page, at the top of a form for example, and the ones that are
  pending show here, not over the page. It is for something that has to survive a redirect, such as "Your changes
  were saved" on the page the form sends the person to.

  An inline notification is viewed once it has been on screen for the banner time (`system:notification_banner_seconds`).
  The X dismisses it and a button acknowledges it. Title and message are rendered as text.

  Attribute: `subtype` shows only that subtype, so a page can have a place for errors and another for the rest.
  A notification that no element on the page shows is left pending, for a page that has one.
*/
export default class NotificationInline extends LightComponent {
  static properties = {
    subtype: { type: String, reflect: true },
    items: { state: true },
    errors: { state: true }
  };

  #stop = null;
  #timers = new Map();
  #visible = false;
  #observer = null;

  constructor(){
    super();
    this.subtype = '';
    this.items = [];
    this.errors = {};
  }

  /*
    Lifecycle Callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    this.#observer = new IntersectionObserver(([entry]) => {
      this.#visible = entry.isIntersecting;
    });
    this.#observer.observe(this);
    this.#stop = subscribe('inline', this.receive);
  }

  disconnectedCallback(){
    super.disconnectedCallback();
    this.#stop?.();
    this.#observer?.disconnect();
    this.#timers.forEach(cancel => cancel());
    this.#timers.clear();
  }

  /*
    Event Handlers
  */

  receive = (notification, controls) => {
    if(this.subtype && notification.subtype !== this.subtype) return;
    if(this.items.some(item => item.notification.id === notification.id)) return;

    this.items = [...this.items, { notification, controls }];

    if(notification.mustAcknowledge) controls.shown();

    /* Time only counts while the element is on screen, so one below the fold is not viewed until it is scrolled to. */
    let seen = 0;
    const tick = setInterval(() => {
      if(document.hidden || !this.#visible) return;
      seen += 1;
      if(seen >= getSettings().bannerSeconds){
        clearInterval(tick);
        controls.viewed();
      }
    }, 1000);
    this.#timers.set(notification.id, () => clearInterval(tick));
  };

  discard = id => {
    this.#timers.get(id)?.();
    this.#timers.delete(id);
    this.items = this.items.filter(item => item.notification.id !== id);
  };

  dismiss = ({ notification, controls }) => {
    controls.dismiss();
    this.discard(notification.id);
  };

  act = async ({ notification, controls }, action) => {
    this.errors = { ...this.errors, [notification.id]: '' };
    const done = await controls.run(action, text => { this.errors = { ...this.errors, [notification.id]: text }; });
    if(done) this.discard(notification.id);
  };

  /*
    Rendering
  */

  renderItem = item => {
    const { notification } = item;
    const actions = notification.actions?.length ? notification.actions : (notification.mustAcknowledge ? [{ label: 'Okay' }] : []);
    return html`
      <div class="d-f p r mb ${COLORS[notification.subtype] ?? 'bg-primary'}" role="status" data-notification-id=${notification.id}>
        <div class="flex">
          <strong>${notification.title}</strong>
          ${notification.message ? html`<div>${notification.message}</div>` : nothing}
          ${actions.length ? html`<div class="mth">${actions.map(action => html`<button class="mr" @click=${() => this.act(item, action)}>${action.label}</button>`)}</div>` : nothing}
          ${this.errors[notification.id] ? html`<div role="alert">${this.errors[notification.id]}</div>` : nothing}
        </div>
        <button class="no-btn" title="Dismiss" aria-label="Dismiss" @click=${() => this.dismiss(item)}><k-icon name="close"></k-icon></button>
      </div>
    `;
  };

  renderLightDom(){
    return html`${this.items.map(this.renderItem)}`;
  }
}

customElements.define('k-notification-inline', NotificationInline);
