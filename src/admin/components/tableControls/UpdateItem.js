import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Updates one row on its own. The page owns the confirmation and the request, so this only reports the
  choice, as an `updateItem` event on the table: { record }.
*/
export default class UpdateItem extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Update';
  }

  handleAction(){
    if(!this.record) return;
    this.table.dispatchEvent(new CustomEvent('updateItem', { detail: { record: this.record } }));
  }

  render(){ return html`<slot><k-icon name="deployed_code_update"></k-icon></slot>`; }
}

customElements.define('admin-update-item', UpdateItem);
