import TableControl from '/kempo-ui/components/tableControls/TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Combobox.js';
import '/kempo-ui/components/Spinner.js';

export default class AddMember extends TableControl {
  groupName = '';

  addMember = () => {
    let selectedUserId = null;

    const $combobox = document.createElement('k-combobox');
    $combobox.setAttribute('placeholder', 'Search users...');
    $combobox.setAttribute('debounce-ms', '350');
    $combobox.setAttribute('require-match', '');

    $combobox.addEventListener('search', async e => {
      $combobox.searching = true;
      const { searchUsers } = await import('/kempo/sdk.js');
      const [err, data] = await searchUsers({ q: e.detail.value, notInGroup: this.groupName, limit: 20 });
      $combobox.searching = false;
      if(err || !data) return;
      $combobox.setOptions(data.users.map(u => ({ label: `${u.name} (${u.email})`, value: u.id })));
    });

    $combobox.addEventListener('select', e => {
      selectedUserId = e.detail.value;
    });

    const $wrap = document.createElement('div');
    $wrap.className = 'p';
    $wrap.appendChild($combobox);

    Dialog.create($wrap, {
      title: 'Add Member',
      confirmText: 'Add',
      confirmAction: async () => {
        if(!selectedUserId) return;
        const { addMemberToGroup } = await import('/kempo/sdk.js');
        const [err] = await addMemberToGroup(this.groupName, selectedUserId);
        if(err){ Toast.error(err.msg || 'Failed to add member'); return; }
        Toast.success('Member added');
        this.dispatchEvent(new CustomEvent('memberAdded', { bubbles: true, composed: true }));
      },
      cancelText: 'Cancel'
    });
  };

  render(){
    return html`
      <button class="no-btn icon-btn" title="Add Member" @click="${this.addMember}">
        <k-icon name="person_add"></k-icon>
      </button>
    `;
  }
}

customElements.define('admin-add-member', AddMember);
