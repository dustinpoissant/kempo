import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { getFragment, updateFragment, deleteFragments, moveFragment, listDirectories } from '/kempo/sdk.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Accordion.js';
import '/kempo-ui/components/CodeEditor.js';

export default class FragmentEditor extends ShadowComponent {
  static properties = {
    loading: { state: true },
    error: { state: true },
    saving: { state: true },
    fragment: { state: true }
  };

  constructor() {
    super();
    this.loading = true;
    this.error = false;
    this.saving = false;
    this.fragment = null;
    this.file = '';
  }

  async connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
    const param = new URLSearchParams(window.location.search).get('fragment');
    this.file = param ? param + '.fragment.html' : '';

    if(!this.file){
      this.loading = false;
      this.error = true;
      return;
    }

    const [err, fragment] = await getFragment(this.file);
    this.loading = false;

    if(err){
      this.error = true;
      return;
    }

    this.fragment = fragment;
    document.title = `Edit: ${fragment.name} - Admin`;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /*
    Helpers
  */

  getFormState() {
    const root = this.shadowRoot;
    return {
      name: root.querySelector('#metaName')?.value ?? this.fragment.name,
      markup: root.querySelector('k-code-editor')?.getValue() ?? this.fragment.markup
    };
  }

  /*
    Event Handlers
  */

  handleKeyDown = e => {
    if((e.ctrlKey || e.metaKey) && e.key === 's'){
      e.preventDefault();
      if(!this.saving && !this.fragment?.locked) this.handleSave();
    }
  };

  handleDelete = () => {
    Dialog.confirm('Delete this fragment? This action cannot be undone.', async confirmed => {
      if(!confirmed) return;
      const [error] = await deleteFragments([this.file]);
      if(error){
        Toast.error(error.msg || 'Failed to delete fragment');
        return;
      }
      Toast.success('Fragment deleted');
      setTimeout(() => { window.location.href = '/admin/content/fragments'; }, 1000);
    });
  };

  handleMove = async () => {
    const [, dirData] = await listDirectories();
    const directories = dirData?.directories || ['.'];

    const parts = this.file.replace(/\.fragment\.html$/, '').split('/');
    const currentName = parts.pop();
    const currentDir = parts.join('/') || '.';

    const isValidDir = p => /^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(p) && !p.includes('..') && !p.includes('//');
    const dirToInternal = p => { const t = (p || '/').replace(/^\//, '').replace(/\/$/, ''); return t || '.'; };
    const currentDirDisplay = currentDir === '.' ? '/' : '/' + currentDir;

    const $dialog = Dialog.create(html`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${currentDirDisplay}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${directories.map(d => html`<option value="${d === '.' ? '/' : '/' + d}">`)}
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Fragment Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${currentName}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `, {
      title: 'Move Fragment',
      confirmText: 'Save and Move Fragment',
      confirmAction: async () => {
        const dirInput = $dialog.querySelector('#dlg-move-dir').value.trim() || '/';
        const newName = $dialog.querySelector('#dlg-move-name').value.trim();
        if(!newName){
          Toast.error('Fragment name is required');
          return;
        }
        if(!isValidDir(dirInput)){
          Toast.error('Invalid directory path');
          return;
        }
        const newDir = dirToInternal(dirInput);
        const newFile = newDir === '.'
          ? `${newName}.fragment.html`
          : `${newDir}/${newName}.fragment.html`;

        this.saving = true;
        const [saveError] = await updateFragment({ file: this.file, markup: this.getFormState().markup });
        this.saving = false;
        if(saveError){
          Toast.error(saveError.msg || 'Failed to save fragment');
          return;
        }

        const [moveError, moved] = await moveFragment({ file: this.file, newFile });
        if(moveError){
          Toast.error(moveError.msg || 'Failed to move fragment');
          return;
        }

        Toast.success('Fragment saved and moved');
        const newParam = moved.file.replace(/\.fragment\.html$/, '');
        setTimeout(() => {
          window.location.href = `/admin/content/fragments/edit?fragment=${encodeURIComponent(newParam)}`;
        }, 1000);
      },
      cancelText: 'Cancel'
    });

    const updatePreview = () => {
      const dir = dirToInternal($dialog.querySelector('#dlg-move-dir').value || '/');
      const name = $dialog.querySelector('#dlg-move-name').value;
      const prefix = dir === '.' ? '/' : '/' + dir + '/';
      $dialog.querySelector('#dlg-move-preview').textContent = name ? prefix + name : '';
    };
    $dialog.querySelector('#dlg-move-dir').addEventListener('input', updatePreview);
    $dialog.querySelector('#dlg-move-name').addEventListener('input', updatePreview);
    updatePreview();
  };

  handleReset = () => {
    Dialog.confirm('Reset this fragment? Any unsaved changes will be lost.', confirmed => {
      if(!confirmed) return;
      this.fragment = { ...this.fragment };
    });
  };

  handleSave = async () => {
    this.saving = true;
    const state = this.getFormState();
    const [saveError, saved] = await updateFragment({ file: this.file, markup: state.markup });
    this.saving = false;

    if(saveError){
      Toast.error(saveError.msg || 'Failed to save fragment');
      return;
    }

    this.fragment = { ...this.fragment, markup: state.markup, updatedAt: saved.updatedAt };

    const slugify = n => n.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const parts = this.file.replace(/\.fragment\.html$/, '').split('/');
    const currentSlug = parts.pop();
    const dir = parts.join('/');
    const newSlug = slugify(state.name);

    if(newSlug && newSlug !== currentSlug){
      const newFile = dir ? `${dir}/${newSlug}.fragment.html` : `${newSlug}.fragment.html`;
      const [moveError, moved] = await moveFragment({ file: this.file, newFile });
      if(moveError){
        Toast.error(moveError.msg || 'Failed to rename fragment file');
        return;
      }
      Toast.success('Fragment saved and renamed');
      const newParam = moved.file.replace(/\.fragment\.html$/, '');
      setTimeout(() => {
        window.location.href = `/admin/content/fragments/edit?fragment=${encodeURIComponent(newParam)}`;
      }, 1000);
      return;
    }

    document.title = `Edit: ${this.fragment.name} - Admin`;
    Toast.success('Fragment saved');
  };

  /*
    Render
  */

  render() {
    if(this.loading) return html`<div>Loading fragment...</div>`;

    if(this.error) return html`
      <div>
        <p>Fragment not found.</p>
        <a href="/admin/content/fragments">Back to Fragments</a>
      </div>
    `;

    const { fragment } = this;
    const isCustom = fragment.owner === 'custom';
    const isLocked = fragment.locked;

    return html`
      ${isLocked ? html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This fragment is locked and cannot be edited. ${fragment.owner === 'custom' ? 'Locked by developer' : `Managed by: ${fragment.owner || 'external system'}`}
        </div>
      ` : ''}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/fragments" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Fragments
          </a>
        </div>
        <div class="flex"></div>
        ${isCustom && !isLocked ? html`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Fragment</button>
          </div>
        ` : ''}
        ${!isLocked ? html`
          <div class="btn-grp mrh mb">
            <button @click="${this.handleReset}"><k-icon name="restart_alt"></k-icon> Reset</button>
            <button id="saveBtn" class="primary" ?disabled="${this.saving}" @click="${this.handleSave}">
              <k-icon name="save"></k-icon> Save
            </button>
          </div>
        ` : ''}
      </div>

      <h1 class="mb">Fragment: ${fragment.name}</h1>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${fragment.name || ''}" ?disabled="${!isCustom || isLocked}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Directory</strong></label>
              <span class="muted">${(() => { const parts = this.file.replace(/\.fragment\.html$/, '').split('/'); parts.pop(); return parts.length ? parts.join('/') : '/'; })()}</span>
              ${isCustom && !isLocked ? html`
                <button class="icon-btn no-btn ph" title="Move Fragment" @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon></button>
              ` : ''}
            </div>
            ${fragment.author ? html`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${fragment.author}</span>
              </div>
            ` : ''}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Owner</strong></label>
              <span class="muted">${fragment.owner || ''}</span>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Created</strong></label>
              <span class="muted">${fragment.createdAt ? new Date(fragment.createdAt).toLocaleString() : ''}</span>
            </div>
            <div class="d-f" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Updated</strong></label>
              <span class="muted">${fragment.updatedAt ? new Date(fragment.updatedAt).toLocaleString() : ''}</span>
            </div>
          </div>
        </k-accordion-panel>
        <k-accordion-header for-panel="fragment" active>Fragment</k-accordion-header>
        <k-accordion-panel name="fragment" active>
          <div class="p">
            <k-code-editor
              class="r b"
              language="html"
              .value="${fragment.markup || ''}"
              style="height: 500px;"
              ?disabled="${isLocked}"
            ></k-code-editor>
          </div>
        </k-accordion-panel>
      </k-accordion>
    `;
  }
}

customElements.define('admin-fragment-editor', FragmentEditor);
