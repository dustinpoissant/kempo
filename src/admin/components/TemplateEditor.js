import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { getTemplate, updateTemplate, deleteTemplates, moveTemplate, createTemplate, listDirectories } from '/kempo/sdk.js';
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

    if (!this.file || this.file === '.template.html') {
      this.loading = false;
      this.error = true;
      return;
    }

    const [err, template] = await getTemplate(this.file);
    this.loading = false;

    if (err) {
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
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!this.saving && !this.template?.locked) this.handleSave();
    }
  };

  handleDelete = () => {
    Dialog.confirm('Delete this template? This action cannot be undone.', async confirmed => {
      if (!confirmed) return;
      const [error] = await deleteTemplates([this.file]);
      if (error) {
        Toast.error(error.msg || 'Failed to delete template');
        return;
      }
      Toast.success('Template deleted');
      setTimeout(() => { window.location.href = '/admin/content/templates'; }, 1000);
    });
  };

  handleMove = async () => {
    const [, dirData] = await listDirectories();
    const directories = dirData?.directories || ['.'];

    const parts = this.file.replace(/\.template\.html$/, '').split('/');
    const currentName = parts.pop();
    const currentDir = parts.join('/') || '.';

    const isValidDir = p => /^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(p) && !p.includes('..') && !p.includes('//');
    const dirToInternal = p => { const t = (p || '/').replace(/^\//, '').replace(/\/$/, ''); return t || '.'; };
    const currentDirDisplay = currentDir === '.' ? '/' : '/' + currentDir;

    const $dialog = Dialog.create(html`
      <div class="p">
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="warning"></k-icon>
          <strong>Warning:</strong> Moving a template may break pages that reference it by name.<br />Pages search for templates by name starting from their own directory up to the root.<br />Moving this template could cause those pages to fall back to the <code>default</code> template.
        </div>
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${currentDirDisplay}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${directories.map(d => html`<option value="${d === '.' ? '/' : '/' + d}">`)} 
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Template Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${currentName}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `, {
      title: 'Move Template',
      confirmText: 'Save and Move Template',
      confirmAction: async () => {
        const dirInput = $dialog.querySelector('#dlg-move-dir').value.trim() || '/';
        const newName = $dialog.querySelector('#dlg-move-name').value.trim();
        if (!newName) {
          Toast.error('Template name is required');
          return;
        }
        if (!isValidDir(dirInput)) {
          Toast.error('Invalid directory path');
          return;
        }
        const newDir = dirToInternal(dirInput);
        const newFile = newDir === '.'
          ? `${newName}.template.html`
          : `${newDir}/${newName}.template.html`;

        this.saving = true;
        const [saveError] = await updateTemplate({ file: this.file, ...this.getFormState() });
        this.saving = false;
        if (saveError) {
          Toast.error(saveError.msg || 'Failed to save template');
          return;
        }

        const [moveError, moved] = await moveTemplate({ file: this.file, newFile });
        if (moveError) {
          Toast.error(moveError.msg || 'Failed to move template');
          return;
        }

        Toast.success('Template saved and moved');
        const newParam = moved.file.replace(/\.template\.html$/, '');
        setTimeout(() => {
          window.location.href = `/admin/content/templates/edit?template=${encodeURIComponent(newParam)}`;
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

  handleCopy = async () => {
    const [, dirData] = await listDirectories();
    const directories = dirData?.directories || ['.'];

    const parts = this.file.replace(/\.template\.html$/, '').split('/');
    const currentName = parts.pop();
    const currentDir = parts.join('/') || '.';

    const isValidDir = p => /^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(p) && !p.includes('..') && !p.includes('//');
    const dirToInternal = p => { const t = (p || '/').replace(/^\//, '').replace(/\/$/, ''); return t || '.'; };
    const currentDirDisplay = currentDir === '.' ? '/' : '/' + currentDir;

    const $dialog = Dialog.create(html`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-copy-dir" class="full" list="dlg-copy-dir-list" .value="${currentDirDisplay}" placeholder="/">
          <datalist id="dlg-copy-dir-list">
            ${directories.map(d => html`<option value="${d === '.' ? '/' : '/' + d}">`)} 
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Template Name</strong></label>
          <input type="text" id="dlg-copy-name" class="full" .value="${currentName}-copy">
          <p class="mt-sm muted"><small id="dlg-copy-preview"></small></p>
        </div>
      </div>
    `, {
      title: 'Copy Template',
      confirmText: 'Copy Template',
      confirmAction: async () => {
        const dirInput = $dialog.querySelector('#dlg-copy-dir').value.trim() || '/';
        const newName = $dialog.querySelector('#dlg-copy-name').value.trim();
        if(!newName){
          Toast.error('Template name is required');
          return;
        }
        if(!isValidDir(dirInput)){
          Toast.error('Invalid directory path');
          return;
        }
        const directory = dirToInternal(dirInput);
        const [error, data] = await createTemplate({ directory: directory === '.' ? '' : directory, name: newName, copyFrom: this.file });
        if(error){
          Toast.error(error.msg || 'Failed to copy template');
          return;
        }
        Toast.success('Template copied');
        setTimeout(() => {
          window.location.href = `/admin/content/templates/edit?template=${encodeURIComponent(data.file.replace(/\.template\.html$/, ''))}`;
        }, 1000);
      },
      cancelText: 'Cancel'
    });

    const updatePreview = () => {
      const dir = dirToInternal($dialog.querySelector('#dlg-copy-dir').value || '/');
      const name = $dialog.querySelector('#dlg-copy-name').value;
      const prefix = dir === '.' ? '/' : '/' + dir + '/';
      $dialog.querySelector('#dlg-copy-preview').textContent = name ? prefix + name : '';
    };
    $dialog.querySelector('#dlg-copy-dir').addEventListener('input', updatePreview);
    $dialog.querySelector('#dlg-copy-name').addEventListener('input', updatePreview);
    updatePreview();
  };

  handleReset = () => {
    Dialog.confirm('Reset this template? Any unsaved changes will be lost.', confirmed => {
      if (!confirmed) return;
      this.template = { ...this.template };
    });
  };

  handleSave = async () => {
    this.saving = true;
    const state = this.getFormState();
    const [saveError, saved] = await updateTemplate({ file: this.file, markup: state.markup });
    this.saving = false;

    if(saveError){
      Toast.error(saveError.msg || 'Failed to save template');
      return;
    }

    this.template = { ...this.template, markup: state.markup, updatedAt: saved.updatedAt };

    const slugify = n => n.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const parts = this.file.replace(/\.template\.html$/, '').split('/');
    const currentSlug = parts.pop();
    const dir = parts.join('/');
    const newSlug = slugify(state.name);

    if(newSlug && newSlug !== currentSlug){
      const newFile = dir ? `${dir}/${newSlug}.template.html` : `${newSlug}.template.html`;
      const [moveError, moved] = await moveTemplate({ file: this.file, newFile });
      if(moveError){
        Toast.error(moveError.msg || 'Failed to rename template file');
        return;
      }
      Toast.success('Template saved and renamed');
      const newParam = moved.file.replace(/\.template\.html$/, '');
      setTimeout(() => {
        window.location.href = `/admin/content/templates/edit?template=${encodeURIComponent(newParam)}`;
      }, 1000);
      return;
    }

    document.title = `Edit: ${template.name} - Admin`;
    Toast.success('Template saved');
  };

  /*
    Render
  */

  render() {
    if (this.loading) return html`<div>Loading template...</div>`;

    if (this.error) return html`
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
          <k-icon name="lock"></k-icon> This template is locked and cannot be edited. ${template.owner === 'custom' ? 'Locked by developer' : `Managed by: ${template.owner || 'external system'}`}
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
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Template</button>
          </div>
        ` : ''}
        <div class="btn-grp mrh mb">
          <button @click="${this.handleCopy}"><k-icon name="content_copy"></k-icon> Copy Template</button>
        </div>
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
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Directory</strong></label>
              <span class="muted">${(() => { const parts = this.file.replace(/\.template\.html$/, '').split('/'); parts.pop(); return parts.length ? parts.join('/') : '/'; })()}</span>
              ${isCustom && !isLocked ? html`
                <button class="icon-btn no-btn ph" title="Move Template" @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon></button>
              ` : ''}
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
