import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class GroupRemoveRecord extends TableControl {
  remove = () => {
    if(this.record) this.table.deleteRecord(this.record);
  };

  render() {
    if(this.record?.name === 'system:Users') return html``;
    return html`
      <button class="no-btn icon-btn" @click="${this.remove}">
        <k-icon name="delete"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-group-remove-record', GroupRemoveRecord);
