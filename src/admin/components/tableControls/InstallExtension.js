import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

export default class InstallExtension extends TableControl {
  install = async () => {
    if(!this.record) return;

    Dialog.confirm(`Install "${this.record.name}"?`, async confirmed => {
      if(!confirmed) return;

      const { installExtension } = await import('/kempo/sdk.js');
      const [error] = await installExtension(this.record.name);

      if(error){
        Toast.error(error.msg || 'Failed to install extension');
        return;
      }

      Toast.success(`"${this.record.name}" installed successfully`);
      this.table.deleteRecord(this.record);
    });
  };

  render(){
    return html`
      <button class="no-btn icon-btn" title="Install Extension" @click="${this.install}">
        <k-icon name="download"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-install-extension', InstallExtension);
