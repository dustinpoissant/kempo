import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Opens one email template in the editor dialog. The dialog belongs to the list, so this only reports the
  choice, as an `editTemplate` event on the table: { record }.
*/
export default class EditEmailTemplate extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Edit';
  }

  handleAction(){
    if(!this.record) return;
    this.table.dispatchEvent(new CustomEvent('editTemplate', { detail: { record: this.record } }));
  }

  render(){ return html`<slot><k-icon name="edit"></k-icon></slot>`; }
}

customElements.define('admin-edit-email-template', EditEmailTemplate);
