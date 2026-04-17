import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, repeat } from '/kempo-ui/lit-all.min.js';
import { getPage, updatePage, listTemplates, deletePages, listDirectories, movePage } from '/kempo/sdk.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Accordion.js';
import '/kempo-ui/components/HtmlEditor.js';

const CODE_MODE_LOCATIONS = new Set(['head', 'scripts']);

const slugify = name => name
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

export default class PageEditor extends ShadowComponent {
  static properties = {
    loading: { state: true },
    error: { state: true },
    saving: { state: true },
    page: { state: true },
    templates: { state: true },
    contents: { state: true }
  };

  constructor() {
    super();
    this.loading = true;
    this.error = false;
    this.saving = false;
    this.page = null;
    this.templates = [];
    this.contents = [];
    this.file = '';
  }

  async connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
    this.file = new URLSearchParams(window.location.search).get('path') + '.page.html';

    if (!this.file || this.file === '.page.html') {
      this.loading = false;
      this.error = true;
      return;
    }

    const [[err, page], [, tmplData]] = await Promise.all([
      getPage(this.file),
      listTemplates()
    ]);

    this.loading = false;

    if (err) {
      this.error = true;
      return;
    }

    this.templates = tmplData?.templates || [];
    this.page = page;
    this.contents = this.buildContents(page.template, page.contents);
    document.title = `Edit: ${page.name || page.title || this.file} - Admin`;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /*
    Helpers
  */

  getPageUrl() {
    const path = this.file.replace(/\.page\.html$/, '');
    return '/' + path.split('/').filter(Boolean).join('/');
  }

  buildContents(templateName, existingContents) {
    const tmpl = this.templates.find(t => t.name === templateName);
    const raw = tmpl?.locations || [{ name: 'default', label: null }];
    const locations = raw.map(l => typeof l === 'string' ? { name: l, label: null } : l);
    const result = locations.map(({ name, label }) => {
      const block = existingContents.find(b => b.location === name);
      return { location: name, label: label || null, content: block?.content || '', orphaned: false };
    });
    for (const block of existingContents) {
      if (!locations.some(l => l.name === block.location))
        result.push({ location: block.location, label: null, content: block.content, orphaned: true });
    }
    return result;
  }

  getFormState() {
    const root = this.shadowRoot;
    const editorMap = new Map(
      [...root.querySelectorAll('k-html-editor[data-location]')].map(ed => [ed.dataset.location, ed.getValue()])
    );
    return {
      name: root.querySelector('#metaName').value,
      title: root.querySelector('#metaTitle').value,
      description: root.querySelector('#metaDescription').value,
      template: root.querySelector('#metaTemplate').value,
      contents: this.contents.map(({ location, content, orphaned }) => ({
        location,
        content: orphaned
          ? (editorMap.get(location)?.trim() || content)
          : (editorMap.get(location) ?? content)
      }))
    };
  }

  /*
    Event Handlers
  */

  handleKeyDown = e => {
    if((e.ctrlKey || e.metaKey) && e.key === 's'){
      e.preventDefault();
      if(!this.saving && !this.page?.locked) this.handleSave();
    }
  };

  handleTemplateChange = e => {
    const newTemplate = e.target.value;
    const editorMap = new Map(
      [...this.shadowRoot.querySelectorAll('k-html-editor[data-location]')].map(ed => [ed.dataset.location, ed.getValue()])
    );
    // Fall back to state content for any editor that hasn't initialized (Monaco lazy-loads)
    const currentContents = this.contents.map(({ location, content }) => ({
      location,
      content: editorMap.get(location)?.trim() || content
    }));
    this.contents = this.buildContents(newTemplate, currentContents);
    this.page = { ...this.page, template: newTemplate };
  };

  handleDelete = () => {
    Dialog.confirm('Delete this page? This action cannot be undone.', async confirmed => {
      if (!confirmed) return;
      const [error] = await deletePages([this.file]);
      if (error) {
        Toast.error(error.msg || 'Failed to delete page');
        return;
      }
      Toast.success('Page deleted');
      setTimeout(() => { window.location.href = '/admin/pages'; }, 1000);
    });
  };

  handleMove = async () => {
    const [, dirData] = await listDirectories();
    const directories = dirData?.directories || ['.'];

    const parts = this.file.replace(/\.page\.html$/, '').split('/');
    const currentName = parts.pop();
    const currentDir = parts.join('/') || '.';

    const isValidDir = p => /^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(p) && !p.includes('..') && !p.includes('//');
    const dirToInternal = p => { const t = (p || '/').replace(/^\//, '').replace(/\/$/, ''); return t || '.'; };
    const currentDirDisplay = currentDir === '.' ? '/' : '/' + currentDir;

    const openLearnMore = () => Dialog.alert(html`
      <div class="p">
        <p>Directory paths define where a page lives in the URL structure.</p>
        <p><strong>Examples:</strong></p>
        <ul>
          <li><code>/</code> — root, e.g. <code>/about</code></li>
          <li><code>/blog</code> — e.g. <code>/blog/my-post</code></li>
          <li><code>/blog/[slug]</code> — dynamic segment; <code>[slug]</code> matches any value</li>
        </ul>
        <p>Dynamic segments like <code>[token]</code> allow a single page to handle many URLs. The segment name is available to the page as a URL parameter.</p>
        <p>You can nest segments: <code>/store/[category]/[id]</code></p>
      </div>
    `, null, { title: 'About Directory Paths' });

    const $dialog = Dialog.create(html`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${currentDirDisplay}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${directories.map(d => html`<option value="${d === '.' ? '/' : '/' + d}">`)} 
          </datalist>
          <p id="dlg-move-dir-error" class="mt-sm tc-danger d-n"><small>Invalid path — use format: /path/to/directory</small></p>
          <p class="mt-sm muted"><small>Supports dynamic segments e.g. <code>/blog/[slug]</code>. <button class="link" @click="${openLearnMore}">Learn more</button></small></p>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Page Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${currentName}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `, {
      title: 'Move Page',
      confirmText: 'Save and Move Page',
      confirmAction: async () => {
        const dirInput = $dialog.querySelector('#dlg-move-dir').value.trim() || '/';
        const newName = slugify($dialog.querySelector('#dlg-move-name').value.trim());
        if (!newName) {
          Toast.error('Page name is required');
          return;
        }
        if (!isValidDir(dirInput)) {
          Toast.error('Invalid directory path');
          return;
        }
        const newDir = dirToInternal(dirInput);
        const newFile = newDir === '.'
          ? `${newName}.page.html`
          : `${newDir}/${newName}.page.html`;

        this.saving = true;
        const [saveError] = await updatePage({ file: this.file, ...this.getFormState() });
        this.saving = false;
        if (saveError) {
          Toast.error(saveError.msg || 'Failed to save page');
          return;
        }

        const [moveError, moved] = await movePage({ file: this.file, newFile });
        if (moveError) {
          Toast.error(moveError.msg || 'Failed to move page');
          return;
        }

        Toast.success('Page saved and moved');
        setTimeout(() => {
          window.location.href = `/admin/pages/edit?path=${encodeURIComponent(moved.file.replace(/\.page\.html$/, ''))}`;
        }, 1000);
      },
      cancelText: 'Cancel'
    });

    const updatePreview = () => {
      const dir = dirToInternal($dialog.querySelector('#dlg-move-dir').value || '/');
      const name = slugify($dialog.querySelector('#dlg-move-name').value);
      const prefix = dir === '.' ? '/' : '/' + dir + '/';
      $dialog.querySelector('#dlg-move-preview').textContent = name ? prefix + name : '';
    };
    $dialog.querySelector('#dlg-move-dir').addEventListener('input', e => {
      $dialog.querySelector('#dlg-move-dir-error').classList.toggle('d-n', isValidDir(e.target.value || '/'));
      updatePreview();
    });
    $dialog.querySelector('#dlg-move-name').addEventListener('input', updatePreview);
    updatePreview();
  };

  handleReset = () => {
    Dialog.confirm('Reset this page? Any unsaved changes will be lost.', confirmed => {
      if (!confirmed) return;
      this.contents = this.buildContents(this.page.template, this.page.contents);
      this.page = { ...this.page };
    });
  };

  handleSave = async () => {
    this.saving = true;
    const state = this.getFormState();
    const [saveError, saved] = await updatePage({ file: this.file, ...state });
    this.saving = false;

    if (saveError) {
      Toast.error(saveError.msg || 'Failed to save page');
      return;
    }

    this.contents = this.contents.map(c => {
      const current = state.contents.find(x => x.location === c.location);
      return current ? { ...c, content: current.content } : c;
    });
    this.page = {
      ...this.page,
      ...state,
      contents: state.contents.filter(b => b.content.trim()),
      updatedAt: saved.updatedAt
    };

    document.title = `Edit: ${state.name || state.title || this.file} - Admin`;
    Toast.success('Page saved');
  };

  /*
    Render
  */

  render() {
    if (this.loading) return html`<div>Loading page...</div>`;

    if (this.error) return html`
      <div>
        <p>Page not found.</p>
        <a href="/admin/pages">Back to Pages</a>
      </div>
    `;

    const { page, templates, contents } = this;
    const isSystem = page.owner === 'system';
    const isLocked = page.locked;

    return html`
      ${isLocked ? html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This page is locked and cannot be edited. It is managed by an extension.
        </div>
      ` : ''}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/pages" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Pages
          </a>
          <a href="${this.getPageUrl()}" id="page-link" class="btn">
            <k-icon name="visibility"></k-icon> View Page
          </a>
        </div>
        
        <div class="flex"></div>
        ${!isSystem && !isLocked ? html`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Page</button>
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
      <h1 class="mb0">Page: ${page.name || page.title || this.file}</h1>

      <a href="${this.getPageUrl()}" class="d-b mb"><code>${this.getPageUrl()}</code></a>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${page.name || ''}" ?disabled="${isSystem || isLocked}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Title</strong></label>
              <input type="text" id="metaTitle" class="flex" .value="${page.title || ''}" ?disabled="${isLocked}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Description</strong></label>
              <input type="text" id="metaDescription" class="flex" .value="${page.description || ''}" ?disabled="${isSystem || isLocked}">
            </div>
            ${!isSystem ? html`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${page.author || ''}</span>
              </div>
            ` : ''}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Template</strong></label>
              <select id="metaTemplate" class="flex" @change="${this.handleTemplateChange}" ?disabled="${isLocked}">
                ${templates.map(t => html`
                  <option value="${t.name}" ?selected="${t.name === page.template}">
                    ${t.directory === '.' ? t.name : `${t.name} (${t.directory})`}
                  </option>
                `)}
              </select>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Owner</strong></label>
              <span class="muted">${page.owner || ''}</span>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Created</strong></label>
              <span class="muted">${page.createdAt ? new Date(page.createdAt).toLocaleString() : ''}</span>
            </div>
            <div class="d-f" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Updated</strong></label>
              <span class="muted">${page.updatedAt ? new Date(page.updatedAt).toLocaleString() : ''}</span>
            </div>
          </div>
        </k-accordion-panel>
        ${repeat(contents, c => c.location, ({ location, label, content, orphaned }) => {
      const isDefault = location === 'default';
      const headerTitle = label || (isDefault ? 'Content' : location.slice(0, 1).toUpperCase() + location.slice(1));
      return html`
            <k-accordion-header for-panel="content-${location}" ?active="${isDefault}">
              ${headerTitle}${orphaned ? html` <span class="tc-warning"><small>(not in template)</small></span>` : ''}
            </k-accordion-header>
            <k-accordion-panel name="content-${location}" ?active="${isDefault}">
              <div class="p">
                <k-html-editor
                  class="r b"
                  data-location="${location}"
                  controls="full"
                  .value="${content}"
                  mode="${CODE_MODE_LOCATIONS.has(location) ? 'code' : 'visual'}"
                  style="height: 400px;"
                  ?disabled="${isLocked}"
                ></k-html-editor>
              </div>
            </k-accordion-panel>
          `;
    })}
      </k-accordion>
    `;
  }
}

customElements.define('admin-page-editor', PageEditor);
