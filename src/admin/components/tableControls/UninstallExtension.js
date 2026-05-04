import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

export default class UninstallExtension extends TableControl {
  uninstall = async () => {
    if(!this.record) return;

    Dialog.confirm(`Uninstall "${this.record.name}"? This may delete extension data.`, async confirmed => {
      if(!confirmed) return;

      const { uninstallExtension } = await import('/kempo/sdk.js');
      const [error] = await uninstallExtension(this.record.name);

      if(error){
        Toast.error(error.msg || 'Failed to uninstall extension');
        return;
      }

      Toast.success(`"${this.record.name}" uninstalled successfully`);
      this.table.deleteRecord(this.record);
    });
  };

  render(){
    return html`
      <button class="no-btn icon-btn" title="Uninstall Extension" @click="${this.uninstall}">
        <k-icon name="extension_remove"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-uninstall-extension', UninstallExtension);
