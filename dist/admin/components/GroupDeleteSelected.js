import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class GroupDeleteSelected extends TableControl {
  constructor() {
    super({ maxWidth: null });
    this.selectionChangeHandler = () => this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    this.onTableEvent('selectionChange', this.selectionChangeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if(this.table) this.table.removeEventListener('selectionChange', this.selectionChangeHandler);
  }

  deleteSelected = () => {
    if(!this.table) return;
    const selected = this.table.getSelectedRecords();
    const records = selected.filter(r => r.name !== 'system:Users');
    if(!records.length) return;
    const systemUsersSkipped = selected.some(r => r.name === 'system:Users');
    this.dispatchEvent(new CustomEvent('groupRemoveSelected', {
      detail: { records, systemUsersSkipped },
      bubbles: true
    }));
  };

  get deletableCount() {
    if(!this.table) return 0;
    return this.table.getSelectedRecords().filter(r => r.name !== 'system:Users').length;
  }

  render() {
    return html`
      <button class="no-btn icon-btn" ?disabled="${this.deletableCount === 0}" @click="${this.deleteSelected}">
        <k-icon name="delete"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-group-delete-selected', GroupDeleteSelected);
