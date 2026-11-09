import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';
import { installWithConfirm } from '/admin/components/extensionInstallDialog.js';

export default class InstallExtension extends AdminTableControl {
  install = () => {
    if(!this.record) return;
    return installWithConfirm(this.record.name, () => window.location.reload());
  };

  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Install Extension';
  }

  handleAction(){ this.install(); }

  render(){ return html`<k-icon name="extension_add"></k-icon>`; }
}

customElements.define('admin-install-extension', InstallExtension);
