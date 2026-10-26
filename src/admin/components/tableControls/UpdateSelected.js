import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';

/*
  Updates every ticked row together. It sits in the table's bottom strip, not in a row, so it reports the
  choice as an `updateSelected` event on the table; the page reads what is ticked.
*/
export default class UpdateSelected extends AdminTableControl {
  handleAction(){
    this.table.dispatchEvent(new CustomEvent('updateSelected'));
  }

  render(){ return html`<slot>Update selected</slot>`; }
}

customElements.define('admin-update-selected', UpdateSelected);
