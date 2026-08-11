import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';

export default class UninstallExtension extends TableControl {
  uninstall = async () => {
    if(!this.record) return;

    /*
      Two genuinely different operations behind one button, so the destructive one is opt-in:
      deregistering leaves the extension's tables, settings, groups and memberships intact and a
      reinstall picks up exactly where it left off, which is what you want when reinstalling to
      apply a fix. Purging destroys all of it — for a blog that is every post and comment.
    */
    const contents = document.createElement('div');
    contents.className = 'p';
    contents.innerHTML = `
      <p>Uninstall "${this.record.name}"?</p>
      <p class="small tc-muted">Its data is kept by default, so reinstalling restores everything.</p>
      <label class="d-f" style="gap: var(--spacer_h); align-items: center">
        <input type="checkbox" name="purge-data" />
        <span class="tc-danger">Also permanently delete all of its data</span>
      </label>
    `;

    Dialog.create(contents, {
      title: 'Uninstall Extension',
      closeBtn: false,
      overlayClose: false,
      confirmText: 'Uninstall',
      confirmClasses: 'danger ml',
      cancelText: 'Cancel',
      confirmAction: async () => {
        const purgeData = contents.querySelector('[name="purge-data"]').checked;
        const { uninstallExtension } = await import('/kempo/sdk.js');
        const [error] = await uninstallExtension(this.record.name, purgeData);

        if(error){
          Toast.error(error.msg || 'Failed to uninstall extension');
          return;
        }

        Toast.success(purgeData
          ? `"${this.record.name}" uninstalled and its data deleted`
          : `"${this.record.name}" uninstalled, its data kept`);
        this.table.deleteRecord(this.record);
      },
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
