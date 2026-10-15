import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

/*
  Switches an installed extension off or on without uninstalling it.

  Disabled, an extension stays installed (its data, settings, groups and hooks are kept) but the CMS
  does not use it: its public files, admin pages, dashboard widgets and hooks are all left out. Turning
  it back on picks up exactly where it was. The server refuses to disable one that an enabled extension
  still depends on, or to enable one whose dependencies are off, and the message says which.
*/
export default class ToggleExtension extends AdminTableControl {
  toggle = async () => {
    const record = this.record;
    if(!record) return;

    const enabling = !record.enabled;

    const apply = async () => {
      const { enableExtension, disableExtension } = await import('/kempo/sdk.js');
      const [error] = await (enabling ? enableExtension : disableExtension)(record.name);

      if(error){
        Toast.error(error.msg || `Failed to ${enabling ? 'enable' : 'disable'} extension`);
        return;
      }

      Toast.success(`"${record.name}" ${enabling ? 'enabled' : 'disabled'}`);
      this.table.updateRecord(record, { enabled: enabling });
      this.requestUpdate();
    };

    if(enabling){
      apply();
      return;
    }

    Dialog.confirm(`Disable "${record.name}"? It stays installed and keeps its data, but its pages, files, widgets and hooks stop being used until you enable it again.`, confirmed => {
      if(confirmed) apply();
    });
  };

  handleAction(){ this.toggle(); }

  render(){
    const disabled = this.record?.enabled === false;
    this.title = disabled ? 'Enable Extension' : 'Disable Extension';
    return html`<k-icon name="${disabled ? 'play' : 'pause'}"></k-icon>`;
  }
}

customElements.define('admin-toggle-extension', ToggleExtension);
