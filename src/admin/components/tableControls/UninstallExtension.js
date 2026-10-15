import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

export default class UninstallExtension extends AdminTableControl {
  uninstall = async () => {
    const record = this.record;
    if(!record) return;

    /*
      An extension cannot stay installed without what it requires, so uninstalling one that others
      require uninstalls them too. The whole chain is fetched and shown first (disabled ones
      included: installed but switched off is still installed), and nothing happens until the
      administrator agrees to all of it.
    */
    const { uninstallExtension, getExtensionDependents } = await import('/kempo/sdk.js');
    const [dependentsError, data] = await getExtensionDependents(record.name, { includeDisabled: true });
    if(dependentsError){
      Toast.error(dependentsError.msg || 'Failed to check what depends on this extension');
      return;
    }
    const dependents = data.dependents;
    const count = dependents.length + 1;

    /*
      Two genuinely different operations behind one button, so the destructive one is opt-in:
      deregistering leaves the extension's tables, settings, groups and memberships intact and a
      reinstall picks up exactly where it left off, which is what you want when reinstalling to
      apply a fix. Purging destroys all of that. For a blog that is every post and comment.
    */
    const contents = document.createElement('div');
    contents.className = 'p';

    const intro = document.createElement('p');
    intro.textContent = dependents.length
      ? `Uninstalling "${record.name}" also uninstalls everything that depends on it:`
      : `Uninstall "${record.name}"?`;
    contents.append(intro);

    if(dependents.length){
      const list = document.createElement('ul');
      for(const dependent of dependents){
        const item = document.createElement('li');
        item.textContent = `${dependent.name} (needs ${dependent.requires.join(', ')})${dependent.enabled ? '' : ' - disabled'}`;
        list.append(item);
      }
      contents.append(list);
    }

    const note = document.createElement('p');
    note.className = 'tc-muted';
    note.textContent = count > 1
      ? 'Their data is kept by default, so reinstalling restores everything.'
      : 'Its data is kept by default, so reinstalling restores everything.';
    contents.append(note);

    const purgeLabel = document.createElement('label');
    purgeLabel.className = 'd-f';
    const purge = document.createElement('input');
    purge.type = 'checkbox';
    purge.name = 'purge-data';
    const purgeText = document.createElement('span');
    purgeText.className = 'tc-danger';
    purgeText.textContent = count > 1
      ? `Also permanently delete all of the data of these ${count} extensions`
      : 'Also permanently delete all of its data';
    purgeLabel.append(purge, purgeText);
    contents.append(purgeLabel);

    Dialog.create(contents, {
      title: count > 1 ? `Uninstall ${count} Extensions` : 'Uninstall Extension',
      closeBtn: false,
      overlayClose: false,
      confirmText: count > 1 ? `Uninstall ${count} extensions` : 'Uninstall',
      confirmClasses: 'danger ml',
      cancelText: 'Cancel',
      confirmAction: async () => {
        const purgeData = purge.checked;
        const [error, result] = await uninstallExtension(record.name, purgeData, { cascade: true });

        if(error){
          Toast.error(error.msg || 'Failed to uninstall extension');
          return;
        }

        for(const removed of result.uninstalled){
          const row = this.table.records.find(candidate => candidate.name === removed);
          if(row) this.table.deleteRecord(row);
        }

        const many = result.uninstalled.length > 1;
        const what = many ? result.uninstalled.join(', ') : `"${record.name}"`;
        Toast.success(purgeData
          ? `${what} uninstalled and ${many ? 'their' : 'its'} data deleted`
          : `${what} uninstalled, data kept`);
      },
    });
  };

  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Uninstall Extension';
  }

  handleAction(){ this.uninstall(); }

  render(){ return html`<k-icon name="extension_remove"></k-icon>`; }
}

customElements.define('admin-uninstall-extension', UninstallExtension);
