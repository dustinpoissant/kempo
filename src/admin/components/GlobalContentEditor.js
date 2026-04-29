import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { getGlobalContent, updateGlobalContent, deleteGlobalContent } from '/kempo/sdk.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Accordion.js';
import '/kempo-ui/components/CodeEditor.js';

export default class GlobalContentEditor extends ShadowComponent {
  static properties = {
    loading: { state: true },
    error: { state: true },
    saving: { state: true },
    entry: { state: true }
  };

  constructor() {
    super();
    this.loading = true;
    this.error = false;
    this.saving = false;
    this.entry = null;
    this.entryId = '';
  }

  async connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
    this.entryId = new URLSearchParams(window.location.search).get('id') || '';

    if(!this.entryId){
      this.loading = false;
      this.error = true;
      return;
    }

    const [err, entry] = await getGlobalContent(this.entryId);
    this.loading = false;

    if(err){
      this.error = true;
      return;
    }

    this.entry = entry;
    document.title = `Edit: ${entry.name || this.entryId} - Admin`;
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
      if(!this.saving && !this.entry?.locked) this.handleSave();
    }
  };

  handleSave = async () => {
    this.saving = true;
    const root = this.shadowRoot;
    const name = root.querySelector('#metaName').value;
    const location = root.querySelector('#metaLocation').value;
    const priority = root.querySelector('#metaPriority').value;
    const editor = root.querySelector('k-code-editor');
    const markup = editor ? editor.getValue() : this.entry.markup;

    const [saveError, saved] = await updateGlobalContent({
      id: this.entryId, name, location, priority, markup
    });
    this.saving = false;

    if(saveError){
      Toast.error(saveError.msg || 'Failed to save global content');
      return;
    }

    this.entry = { ...this.entry, name, location, priority, markup, updatedAt: saved.updatedAt };
    document.title = `Edit: ${name || this.entryId} - Admin`;
    Toast.success('Global content saved');
  };

  handleReset = () => {
    Dialog.confirm('Reset this entry? Any unsaved changes will be lost.', confirmed => {
      if(!confirmed) return;
      this.entry = { ...this.entry };
    });
  };

  handleDelete = () => {
    Dialog.confirm('Delete this global content entry? This action cannot be undone.', async confirmed => {
      if(!confirmed) return;
      const [error] = await deleteGlobalContent([this.entryId]);
      if(error){
        Toast.error(error.msg || 'Failed to delete global content');
        return;
      }
      Toast.success('Global content deleted');
      setTimeout(() => { window.location.href = '/admin/content/globals'; }, 1000);
    });
  };

  /*
    Render
  */

  render() {
    if(this.loading) return html`<div>Loading global content...</div>`;

    if(this.error) return html`
      <div>
        <p>Global content entry not found.</p>
        <a href="/admin/content/globals">Back to Global Content</a>
      </div>
    `;

    const { entry } = this;
    const isSystem = entry.owner === 'system';
    const isLocked = entry.locked;

    return html`
      ${isLocked ? html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This entry is locked and cannot be edited. ${entry.owner === 'custom' ? 'Locked by developer' : `Managed by: ${entry.owner || 'external system'}`}
        </div>
      ` : ''}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/globals" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Global Content
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
      <h1 class="mb">Global Content: ${entry.name || this.entryId}</h1>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${entry.name || ''}" ?disabled="${isSystem || isLocked}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Location</strong></label>
              <input type="text" id="metaLocation" class="flex" .value="${entry.location || ''}" ?disabled="${isSystem || isLocked}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Priority</strong></label>
              <input type="number" id="metaPriority" class="flex" .value="${entry.priority ?? 0}" ?disabled="${isSystem || isLocked}">
            </div>
            ${!isSystem ? html`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${entry.author || ''}</span>
              </div>
            ` : ''}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Owner</strong></label>
              <span class="muted">${entry.owner || ''}</span>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Created</strong></label>
              <span class="muted">${entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
            </div>
            <div class="d-f" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Updated</strong></label>
              <span class="muted">${entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : ''}</span>
            </div>
          </div>
        </k-accordion-panel>
        <k-accordion-header for-panel="content" active>Content</k-accordion-header>
        <k-accordion-panel name="content" active>
          <div class="p">
            <k-code-editor
              class="r b"
              language="html"
              .value="${entry.markup || ''}"
              style="height: 500px;"
              ?disabled="${isLocked}"
            ></k-code-editor>
          </div>
        </k-accordion-panel>
      </k-accordion>
    `;
  }
}

customElements.define('admin-global-content-editor', GlobalContentEditor);
