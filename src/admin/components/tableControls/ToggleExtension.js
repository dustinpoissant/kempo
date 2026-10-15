import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

/*
  Switches an installed extension off or on without uninstalling it.

  Disabled, an extension stays installed (its data, settings, groups and hooks are kept) but the CMS
  does not use it: its public files, admin pages, dashboard widgets and hooks are all left out. Turning
  it back on picks up exactly where it was.

  Disabling something other extensions require disables them too, and the whole chain is shown before
  anything happens: what requires it, what requires those, and so on. Enabling is one at a time, and
  the server refuses while something it requires is still off.
*/
export default class ToggleExtension extends AdminTableControl {
  #confirmDisable = (name, dependents) => {
    const contents = document.createElement('div');
    contents.className = 'p';

    const intro = document.createElement('p');
    intro.textContent = dependents.length
      ? `Disabling "${name}" also disables everything that depends on it:`
      : `Disable "${name}"?`;
    contents.append(intro);

    if(dependents.length){
      const list = document.createElement('ul');
      for(const dependent of dependents){
        const item = document.createElement('li');
        item.textContent = `${dependent.name} (needs ${dependent.requires.join(', ')})`;
        list.append(item);
      }
      contents.append(list);
    }

    const note = document.createElement('p');
    note.className = 'tc-muted';
    note.textContent = 'Nothing is uninstalled. Each keeps its data and settings, but its pages, files, widgets and hooks stop being used until it is enabled again.';
    contents.append(note);

    return new Promise(resolve => {
      Dialog.create(contents, {
        title: dependents.length ? `Disable ${dependents.length + 1} Extensions` : 'Disable Extension',
        closeBtn: false,
        overlayClose: false,
        confirmText: dependents.length ? `Disable ${dependents.length + 1} extensions` : 'Disable',
        confirmClasses: 'danger ml',
        cancelText: 'Cancel',
        confirmAction: () => resolve(true),
        cancelAction: () => resolve(false),
      });
    });
  };

  toggle = async () => {
    const record = this.record;
    if(!record) return;

    const { enableExtension, disableExtension, getExtensionDependents } = await import('/kempo/sdk.js');

    if(record.enabled === false){
      const [error] = await enableExtension(record.name);
      if(error){
        Toast.error(error.msg || 'Failed to enable extension');
        return;
      }
      Toast.success(`"${record.name}" enabled`);
      this.table.updateRecord(record, { enabled: true });
      this.requestUpdate();
      return;
    }

    const [dependentsError, data] = await getExtensionDependents(record.name);
    if(dependentsError){
      Toast.error(dependentsError.msg || 'Failed to check what depends on this extension');
      return;
    }

    if(!(await this.#confirmDisable(record.name, data.dependents))) return;

    const [error, result] = await disableExtension(record.name, { cascade: true });
    if(error){
      Toast.error(error.msg || 'Failed to disable extension');
      return;
    }

    for(const disabledName of result.disabled){
      const row = this.table.records.find(candidate => candidate.name === disabledName);
      if(row) this.table.updateRecord(row, { enabled: false });
    }
    Toast.success(result.disabled.length > 1 ? `Disabled ${result.disabled.join(', ')}` : `"${record.name}" disabled`);
    this.requestUpdate();
  };

  handleAction(){ this.toggle(); }

  render(){
    const disabled = this.record?.enabled === false;
    this.title = disabled ? 'Enable Extension' : 'Disable Extension';
    return html`<k-icon name="${disabled ? 'play' : 'pause'}"></k-icon>`;
  }
}

customElements.define('admin-toggle-extension', ToggleExtension);
