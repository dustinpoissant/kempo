import AdminTableControl from './AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class GroupRemoveRecord extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Remove from Group';
  }

  handleAction(){
    if(this.record && this.record.name !== 'system:Users') this.table.deleteRecord(this.record);
  }

  render(){
    // system:Users is the built-in group every user belongs to and cannot be removed from
    if(this.record?.name === 'system:Users') return html``;
    return html`<k-icon name="delete"></k-icon>`;
  }
}

customElements.define('admin-group-remove-record', GroupRemoveRecord);
