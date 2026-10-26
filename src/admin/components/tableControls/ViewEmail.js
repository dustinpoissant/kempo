import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Opens one email from the log. The dialog that shows it belongs to the log, so this only reports the
  choice, as an `emailView` event on the table: { record }.
*/
export default class ViewEmail extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'View';
  }

  handleAction(){
    if(!this.record) return;
    this.table.dispatchEvent(new CustomEvent('emailView', { detail: { record: this.record } }));
  }

  render(){ return html`<slot><k-icon name="visibility"></k-icon></slot>`; }
}

customElements.define('admin-view-email', ViewEmail);
