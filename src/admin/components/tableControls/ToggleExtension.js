import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import { confirmChain, enableWithConfirm, offerSuggested } from '/admin/components/extensionInstallDialog.js';

/*
  Switches an installed extension off or on without uninstalling it. Both ask first.

  Disabled, an extension stays installed (its data, settings, groups and hooks are kept) but the CMS
  does not use it: its public files, admin pages, dashboard widgets and hooks are all left out. Turning
  it back on picks up exactly where it was.

  An extension cannot run without what it requires, so both directions act on the whole chain, and
  show it before anything happens:
    disabling  also disables what depends on it, and what depends on those, and so on
    enabling   also enables what it requires that is switched off, and what those require, and so on
  Enabling never turns on anything else that happened to be switched off with it. After an enable, what the extensions
  just turned on suggest to go with them is offered (see \`offerSuggested\`).
*/
export default class ToggleExtension extends AdminTableControl {
  /*
    A toggled extension belongs to the other tab now, so it leaves this table and the page loads both lists again (recordDeleted).
    The table is passed in because removing a row removes this control with it, and a control that is not on the page has no
    table: looking it up again for the second extension of a chain failed.
  */
  #moveRows = (table, names) => {
    for(const name of names){
      const row = table.records.find(candidate => candidate?.name === name);
      if(row) table.deleteRecord(row);
    }
  };

  #enable = async (record, table) => {
    const result = await enableWithConfirm(record.name);
    if(!result) return;
    offerSuggested(result.enabledNames, added => added && window.location.reload());
    this.#moveRows(table, result.enabledNames);
  };

  #disable = async (record, table, sdk) => {
    const [dependentsError, data] = await sdk.getExtensionDependents(record.name);
    if(dependentsError){
      Toast.error(dependentsError.msg || 'Failed to check what depends on this extension');
      return;
    }

    const dependents = data.dependents;
    const agreed = await confirmChain({
      title: dependents.length ? `Disable ${dependents.length + 1} Extensions` : 'Disable Extension',
      intro: dependents.length
        ? `Disabling "${record.name}" also disables everything that depends on it:`
        : `Disable "${record.name}"? It stays installed and keeps its data, but its pages, files, widgets and hooks stop being used until you enable it again.`,
      items: dependents.map(dependent => `${dependent.name} (needs ${dependent.requires.join(', ')})`),
      confirmText: dependents.length ? `Disable ${dependents.length + 1} extensions` : 'Disable',
      danger: true,
    });
    if(!agreed) return;

    const [error, result] = await sdk.disableExtension(record.name, { cascade: true });
    if(error){
      Toast.error(error.msg || 'Failed to disable extension');
      return;
    }

    Toast.success(result.disabled.length > 1 ? `Disabled ${result.disabled.join(', ')}` : `"${record.name}" disabled`);
    this.#moveRows(table, result.disabled);
  };

  toggle = async () => {
    const record = this.record;
    const table = this.table;
    if(!record || !table) return;

    if(record.enabled === false) await this.#enable(record, table);
    else await this.#disable(record, table, await import('/kempo/sdk.js'));
  };

  handleAction(){ this.toggle(); }

  render(){
    const disabled = this.record?.enabled === false;
    this.title = disabled ? 'Enable Extension' : 'Disable Extension';
    return html`<k-icon name="${disabled ? 'play' : 'pause'}"></k-icon>`;
  }
}

customElements.define('admin-toggle-extension', ToggleExtension);
