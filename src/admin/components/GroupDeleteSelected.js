import AdminTableControl from './AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class GroupDeleteSelected extends AdminTableControl {
  // Control re-renders on these host events, replacing the manual listener wiring
  static hostEvents = ['selectionChange'];

  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Remove Selected';
  }

  get deletableCount(){
    if(!this.table) return 0;
    return this.table.getSelectedRecords().filter(r => r.name !== 'system:Users').length;
  }

  willUpdate(){
    this.disabled = this.deletableCount === 0;
  }

  handleAction(){
    if(!this.table) return;
    const selected = this.table.getSelectedRecords();
    const records = selected.filter(r => r.name !== 'system:Users');
    if(!records.length) return;
    this.dispatchEvent(new CustomEvent('groupRemoveSelected', {
      detail: { records, systemUsersSkipped: selected.some(r => r.name === 'system:Users') },
      bubbles: true
    }));
  }

  render(){ return html`<k-icon name="delete"></k-icon>`; }
}

customElements.define('admin-group-delete-selected', GroupDeleteSelected);
