import AdminTableControl from './AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class ClearExpiredSessionsControl extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Clear Expired Sessions';
  }

  render(){ return html`<k-icon name="timer_off"></k-icon>`; }
}

customElements.define('admin-clear-expired-sessions', ClearExpiredSessionsControl);
