import { html } from '/kempo-ui/lit-all.min.js';
import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

export default class TableRowDelete extends TableControl {
  static properties = {
    maxWidth: { type: Number, attribute: 'max-width' },
    sdkMethod: { type: String, attribute: 'sdk-method' },
    primaryKey: { type: String, attribute: 'primary-key' }
  };

  constructor(){
    super();
    this.maxWidth = 40;
    this.sdkMethod = 'deleteUsers';
    this.idField = 'id';
  }

  delete = () => {
    if(!this.record) return;

    Dialog.confirm('Are you sure you want to delete this record? This action cannot be undone.', async (confirmed) => {
      if(!confirmed) return;

      const module = await import('../../kempo/sdk.js');
      const deleteMethod = module[this.sdkMethod];

      if(!deleteMethod){
        Toast.error('Delete method not found');
        return;
      }

      const [error, result] = await deleteMethod([this.record[this.primaryKey]]);

      if(error){
        Toast.error(error.msg || 'Failed to delete record');
        return;
      }

      this.table.deleteRecord(this.record);
      Toast.success('Record deleted successfully');
    });
  };

  render(){
    return html`<button class="no-btn icon-btn" @click="${this.delete}">
      <slot><k-icon name="delete"></k-icon></slot>
    </button>`;
  }
}

customElements.define('admin-table-row-delete', TableRowDelete);
