import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Combobox.js';

export default class AddPermission extends TableControl {
  groupName = '';

  addPermission = async () => {
    const { listPermissions, getGroupPermissions, addPermissionToGroup } = await import('/kempo/sdk.js');

    const [[allErr, allData], [groupErr, groupPerms]] = await Promise.all([
      listPermissions({ limit: 1000 }),
      getGroupPermissions(this.groupName)
    ]);

    if(allErr){ Toast.error(allErr.msg || 'Failed to load permissions'); return; }
    if(groupErr){ Toast.error(groupErr.msg || 'Failed to load group permissions'); return; }

    const assigned = new Set(groupPerms.permissions);
    const available = allData.permissions.filter(p => !assigned.has(p.name));

    let selectedPermName = null;

    const $combobox = document.createElement('k-combobox');
    $combobox.setAttribute('placeholder', 'Search permissions...');
    $combobox.setAttribute('require-match', '');
    $combobox.setOptions(available.map(p => ({ label: p.name, value: p.name })));

    $combobox.addEventListener('select', e => {
      selectedPermName = e.detail.value;
    });

    const $wrap = document.createElement('div');
    $wrap.className = 'p';
    $wrap.appendChild($combobox);

    Dialog.create($wrap, {
      title: 'Add Permission',
      confirmText: 'Add',
      confirmAction: async () => {
        if(!selectedPermName) return;
        const [err] = await addPermissionToGroup(this.groupName, selectedPermName);
        if(err){ Toast.error(err.msg || 'Failed to add permission'); return; }
        Toast.success('Permission added');
        this.dispatchEvent(new CustomEvent('permissionAdded', { bubbles: true, composed: true }));
      },
      cancelText: 'Cancel'
    });
  };

  render(){
    return html`
      <button class="no-btn icon-btn" title="Add Permission" @click="${this.addPermission}">
        <k-icon name="lock_add"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-add-permission', AddPermission);
