import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

export default class InstallExtension extends AdminTableControl {
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

  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Install Extension';
  }

  handleAction(){ this.install(); }

  render(){ return html`<k-icon name="extension_add"></k-icon>`; }
}

customElements.define('admin-install-extension', InstallExtension);
