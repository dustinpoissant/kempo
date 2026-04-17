import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { getFragment, updateFragment, deleteFragments } from '/kempo/sdk.js';
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
    document.title = `Edit: ${fragment.name || this.file} - Admin`;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
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

  handleSave = async () => {
    this.saving = true;
    const root = this.shadowRoot;
    const name = root.querySelector('#metaName').value;
    const editor = root.querySelector('k-code-editor');
    const markup = editor ? editor.getValue() : this.fragment.markup;

    const [saveError, saved] = await updateFragment({ file: this.file, name, markup });
    this.saving = false;

    if(saveError){
      Toast.error(saveError.msg || 'Failed to save fragment');
      return;
    }

    this.fragment = { ...this.fragment, name, markup, updatedAt: saved.updatedAt };
    document.title = `Edit: ${name || this.file} - Admin`;
    Toast.success('Fragment saved');
  };

  handleReset = () => {
    Dialog.confirm('Reset this fragment? Any unsaved changes will be lost.', confirmed => {
      if(!confirmed) return;
      this.fragment = { ...this.fragment };
    });
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
    const isSystem = fragment.owner === 'system';
    const isLocked = fragment.locked;

    return html`
      ${isLocked ? html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This fragment is locked and cannot be edited. It is managed by ${isSystem ? 'the system' : 'an extension'}.
        </div>
      ` : ''}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/fragments" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Fragments
          </a>
        </div>
        <div class="flex"></div>
        ${!isSystem && !isLocked ? html`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
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
      <h1 class="mb">Fragment: ${fragment.name || this.file}</h1>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${fragment.name || ''}" ?disabled="${isSystem || isLocked}">
            </div>
            ${!isSystem ? html`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${fragment.author || ''}</span>
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
