import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { getTemplate, updateTemplate, deleteTemplates } from '/kempo/sdk.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Accordion.js';
import '/kempo-ui/components/CodeEditor.js';

export default class TemplateEditor extends ShadowComponent {
  static properties = {
    loading: { state: true },
    error: { state: true },
    saving: { state: true },
    template: { state: true }
  };

  constructor() {
    super();
    this.loading = true;
    this.error = false;
    this.saving = false;
    this.template = null;
    this.file = '';
  }

  async connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
    const param = new URLSearchParams(window.location.search).get('template');
    this.file = param + '.template.html';

    if(!this.file || this.file === '.template.html'){
      this.loading = false;
      this.error = true;
      return;
    }

    const [err, template] = await getTemplate(this.file);
    this.loading = false;

    if(err){
      this.error = true;
      return;
    }

    this.template = template;
    document.title = `Edit: ${template.name} - Admin`;
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
      name: root.querySelector('#metaName')?.value ?? this.template.name,
      markup: root.querySelector('#templateEditor')?.getValue() ?? this.template.markup
    };
  }

  /*
    Event Handlers
  */

  handleKeyDown = e => {
    if((e.ctrlKey || e.metaKey) && e.key === 's'){
      e.preventDefault();
      if(!this.saving && !this.template?.locked) this.handleSave();
    }
  };

  handleDelete = () => {
    Dialog.confirm('Delete this template? This action cannot be undone.', async confirmed => {
      if(!confirmed) return;
      const [error] = await deleteTemplates([this.file]);
      if(error){
        Toast.error(error.msg || 'Failed to delete template');
        return;
      }
      Toast.success('Template deleted');
      setTimeout(() => { window.location.href = '/admin/content/templates'; }, 1000);
    });
  };

  handleReset = () => {
    Dialog.confirm('Reset this template? Any unsaved changes will be lost.', confirmed => {
      if(!confirmed) return;
      this.template = { ...this.template };
    });
  };

  handleSave = async () => {
    this.saving = true;
    const state = this.getFormState();
    const [saveError, saved] = await updateTemplate({ file: this.file, ...state });
    this.saving = false;

    if(saveError){
      Toast.error(saveError.msg || 'Failed to save template');
      return;
    }

    this.template = {
      ...this.template,
      ...state,
      updatedAt: saved.updatedAt
    };

    document.title = `Edit: ${state.name} - Admin`;
    Toast.success('Template saved');
  };

  /*
    Render
  */

  render() {
    if(this.loading) return html`<div>Loading template...</div>`;

    if(this.error) return html`
      <div>
        <p>Template not found.</p>
        <a href="/admin/content/templates">Back to Templates</a>
      </div>
    `;

    const { template } = this;
    const isCustom = template.owner === 'custom';
    const isLocked = template.locked;

    return html`
      ${isLocked ? html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This template is locked and cannot be edited. It is managed by an extension.
        </div>
      ` : ''}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/templates" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Templates
          </a>
        </div>
        <div class="flex"></div>
        ${isCustom && !isLocked ? html`
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

      <h1 class="mb">Template: ${template.name}</h1>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${template.name || ''}" ?disabled="${!isCustom || isLocked}">
            </div>
            ${template.author ? html`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${template.author}</span>
              </div>
            ` : ''}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Owner</strong></label>
              <span class="muted">${template.owner || ''}</span>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Created</strong></label>
              <span class="muted">${template.createdAt ? new Date(template.createdAt).toLocaleString() : ''}</span>
            </div>
            <div class="d-f" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Updated</strong></label>
              <span class="muted">${template.updatedAt ? new Date(template.updatedAt).toLocaleString() : ''}</span>
            </div>
          </div>
        </k-accordion-panel>

        <k-accordion-header for-panel="template" active>Template</k-accordion-header>
        <k-accordion-panel name="template" active>
          <div class="p">
            <k-code-editor
              id="templateEditor"
              class="r b"
              language="html"
              .value="${template.markup || ''}"
              style="height: 70vh; min-height: 400px;"
              ?disabled="${isLocked}"
            ></k-code-editor>
          </div>
        </k-accordion-panel>
      </k-accordion>
    `;
  }
}

customElements.define('admin-template-editor', TemplateEditor);
