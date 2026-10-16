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

  An extension cannot run without what it requires, so both directions act on the whole chain, and
  show it before anything happens:
    disabling  also disables what depends on it, and what depends on those, and so on
    enabling   also enables what it requires that is switched off, and what those require, and so on
  Enabling never turns on anything else that happened to be switched off with it.
*/
export default class ToggleExtension extends AdminTableControl {
  #confirm = ({ title, intro, items, confirmText, danger }) => {
    const contents = document.createElement('div');
    contents.className = 'p';

    const text = document.createElement('p');
    text.textContent = intro;
    contents.append(text);

    if(items.length){
      const list = document.createElement('ul');
      for(const entry of items){
        const item = document.createElement('li');
        item.textContent = entry;
        list.append(item);
      }
      contents.append(list);
    }

    return new Promise(resolve => {
      Dialog.create(contents, {
        title,
        closeBtn: false,
        overlayClose: false,
        confirmText,
        confirmClasses: danger ? 'danger ml' : 'primary ml',
        cancelText: 'Cancel',
        confirmAction: () => resolve(true),
        cancelAction: () => resolve(false),
      });
    });
  };

  #markRows = (names, enabled) => {
    for(const name of names){
      const row = this.table.records.find(candidate => candidate.name === name);
      if(row) this.table.updateRecord(row, { enabled });
    }
  };

  #enable = async (record, sdk) => {
    const [requirementsError, data] = await sdk.getExtensionRequirements(record.name);
    if(requirementsError){
      Toast.error(requirementsError.msg || 'Failed to check what this extension requires');
      return;
    }

    if(data.missing.length){
      Toast.error(`"${record.name}" requires ${data.missing.join(', ')}, which ${data.missing.length === 1 ? 'is' : 'are'} not installed`);
      return;
    }

    const requirements = data.disabled;
    if(requirements.length){
      const agreed = await this.#confirm({
        title: `Enable ${requirements.length + 1} Extensions`,
        intro: `"${record.name}" cannot run without these, which are switched off. Enabling it also enables:`,
        items: requirements.map(requirement => requirement.requires.length ? `${requirement.name} (needs ${requirement.requires.join(', ')})` : requirement.name),
        confirmText: `Enable ${requirements.length + 1} extensions`,
        danger: false,
      });
      if(!agreed) return;
    }

    const [error, result] = await sdk.enableExtension(record.name, { cascade: true });
    if(error){
      Toast.error(error.msg || 'Failed to enable extension');
      return;
    }

    this.#markRows(result.enabledNames, true);
    Toast.success(result.enabledNames.length > 1 ? `Enabled ${result.enabledNames.join(', ')}` : `"${record.name}" enabled`);
    this.requestUpdate();
  };

  #disable = async (record, sdk) => {
    const [dependentsError, data] = await sdk.getExtensionDependents(record.name);
    if(dependentsError){
      Toast.error(dependentsError.msg || 'Failed to check what depends on this extension');
      return;
    }

    const dependents = data.dependents;
    const agreed = await this.#confirm({
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

    this.#markRows(result.disabled, false);
    Toast.success(result.disabled.length > 1 ? `Disabled ${result.disabled.join(', ')}` : `"${record.name}" disabled`);
    this.requestUpdate();
  };

  toggle = async () => {
    const record = this.record;
    if(!record) return;

    const sdk = await import('/kempo/sdk.js');
    if(record.enabled === false) await this.#enable(record, sdk);
    else await this.#disable(record, sdk);
  };

  handleAction(){ this.toggle(); }

  render(){
    const disabled = this.record?.enabled === false;
    this.title = disabled ? 'Enable Extension' : 'Disable Extension';
    return html`<k-icon name="${disabled ? 'play' : 'pause'}"></k-icon>`;
  }
}

customElements.define('admin-toggle-extension', ToggleExtension);
