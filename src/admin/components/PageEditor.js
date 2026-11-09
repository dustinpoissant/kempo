import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css, repeat, staticHtml, unsafeStatic } from '/kempo-ui/lit-all.min.js';
import { getPage, updatePage, listTemplates, deletePages, listDirectories, movePage, copyPage, listPages, openSitebuilderPage, saveSitebuilderPage, resolveSitebuilderConflict, leaveSitebuilderCodeMode } from '/kempo/sdk.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import { getComponentOverride, getEditorExtensions } from '../component-overrides.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Tabs.js';
import '/kempo-ui/components/HtmlEditor.js';
import '/kempo-ui/components/CodeEditor.js';
import '/kempo-ui/components/Dropdown.js';
import './pagebuilder/PageBuilderEditor.js';

const CODE_MODE_LOCATIONS = new Set(['head']);

const slugify = name => name
  .toLowerCase()
  .trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

/* The page's address as the person types it: a path, with or without the leading slash and .page.html. */
const toFile = path => `${String(path).trim().replace(/^\//, '').replace(/\/$/, '').replace(/\.page\.html$/, '')}.page.html`;

const previewDocument = body => `<!DOCTYPE html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/kempo-css/kempo.min.css"><link rel="stylesheet" href="/styles.css"><script src="/init.js"></script><script type="module" src="/kempo-ui/utils/theme.js"></script></head><body><main class="p">${body}</main></body></html>`;

export default class PageEditor extends ShadowComponent {
  static properties = {
    loading: { state: true },
    error: { state: true },
    saving: { state: true },
    page: { state: true },
    templates: { state: true },
    contents: { state: true },
    builder: { state: true },
    meta: { state: true }
  };

  /*
    A page the builder can edit takes over the whole screen but the admin's side navigation: the editor is fixed over the
    area k-main would have filled, out of its container, and everything else a page editor offers is in the builder's
    control bar.
  */
  static styles = css`
    :host([builder]) {
      position: fixed;
      top: 0;
      bottom: 0;
      left: var(--left-panel-width, 0px);
      right: var(--right-panel-width, 0px);
      z-index: 1;
      display: block;
      background: var(--c_bg, #fff);
      transition: left var(--animation_ms, 256ms), right var(--animation_ms, 256ms);
    }
    admin-page-builder { display: block; height: 100%; }
  `;

  constructor() {
    super();
    this.loading = true;
    this.error = false;
    this.saving = false;
    this.page = null;
    this.templates = [];
    this.contents = [];
    this.builder = null;
    this.meta = null;
    this.metaDirty = false;
    this.codeDirty = false;
    this.file = '';
  }

  updated(changed) {
    super.updated(changed);
    this.toggleAttribute('builder', !this.loading && this.inBuilder);
  }

  /* Changes made outside the builder's own tree (the page's settings and its head) that are not saved yet. */
  get extrasDirty() {
    return this.metaDirty || this.codeDirty;
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

    await this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /*
    Loading: the page itself, its templates, and what state the builder finds it in.
  */

  async load() {
    this.loading = true;
    const [[err, page], [, tmplData]] = await Promise.all([
      getPage(this.file),
      listTemplates()
    ]);

    if (err) {
      this.loading = false;
      this.error = true;
      return;
    }

    this.templates = tmplData?.templates || [];
    this.page = page;
    this.contents = this.buildContents(page.template, page.contents);
    this.meta = { name: page.name || '', title: page.title || '', description: page.description || '', template: page.template };
    this.metaDirty = false;
    this.codeDirty = false;
    await this.openBuilder();
    this.loading = false;
    document.title = `Edit: ${page.name || page.title || this.file} - Admin`;
    if (this.builder?.state === 'conflict') this.showConflict();
  }

  /* A page the builder cannot be asked about (an old server, a missing permission) is simply edited as code. */
  async openBuilder() {
    const [error, result] = await openSitebuilderPage(this.file);
    this.builder = error ? null : result;
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
    if (this.inBuilder) return { ...this.meta, contents: this.contents.map(({ location, content }) => ({ location, content })) };
    const root = this.shadowRoot;
    const editorMap = new Map(
      [...root.querySelectorAll('[data-location]')].map(ed => [ed.dataset.location, ed.getValue()])
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

  get inBuilder() {
    return this.builder?.state === 'builder' && !this.page?.locked;
  }

  get pageName() {
    return this.meta?.name || this.meta?.title || this.page?.name || this.page?.title || this.file;
  }

  /*
    Saving. In the builder the trees, the code locations and the settings go together, with the hash of the file the
    editor opened so a change made meanwhile is noticed. As code, the page is written as it always was.
    Resolves to [error, saved].
  */
  async persist() {
    if (!this.inBuilder) {
      const [error, saved] = await updatePage({ file: this.file, ...this.getFormState() });
      return [error, saved];
    }
    const editor = this.shadowRoot.querySelector('admin-page-builder');
    const state = this.getFormState();
    const codeBlocks = Object.fromEntries(state.contents.filter(block => CODE_MODE_LOCATIONS.has(block.location)).map(block => [block.location, block.content]));
    const [error, saved] = await saveSitebuilderPage({
      file: this.file,
      trees: editor.getTrees(),
      codeBlocks,
      changes: { name: state.name, title: state.title, description: state.description, template: state.template },
      loadedHash: this.builder.hash
    });
    if (error) return [error, null];
    this.builder = { ...this.builder, hash: saved.hash };
    editor.markSaved();
    return [null, saved];
  }

  /* Public: the builder's control bar saves through this. */
  save = () => {
    if (this.saving || this.page?.locked) return Promise.resolve();
    return this.handleSave();
  };

  /*
    Event Handlers
  */

  handleKeyDown = e => {
    /* The page builder saves on Ctrl+S itself (and so would save twice). */
    if (this.inBuilder) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this.save();
    }
  };

  handleTemplateChange = e => {
    if (this.page?.locked) return;
    const newTemplate = e.target.value;
    const editorMap = new Map(
      [...this.shadowRoot.querySelectorAll('[data-location]')].map(ed => [ed.dataset.location, ed.getValue()])
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
        const [saveError] = await this.persist();
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
          window.location.href = `/admin/content/pages/edit?path=${encodeURIComponent(moved.file.replace(/\.page\.html$/, ''))}`;
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

  /*
    A copy is how a draft is made: nothing links to it, so it can be edited and looked at by its address, and then it
    replaces the original.
  */
  handleCopy = () => {
    const parts = this.file.replace(/\.page\.html$/, '').split('/');
    const name = parts.pop();
    const directory = parts.join('/');
    const $dialog = Dialog.create(html`
      <div class="p">
        <label class="d-b mbq" for="dlg-copy-path">Address of the copy<small class="d-b tc-muted">The copy is a separate page. Nothing links to it, so you can work on it privately and then replace the original with it.</small></label>
        <input type="text" id="dlg-copy-path" class="full" .value="${'/' + [directory, `${name}-draft`].filter(Boolean).join('/')}">
      </div>
    `, {
      title: 'Copy this page',
      confirmText: 'Copy page',
      cancelText: 'Cancel',
      confirmAction: async event => {
        const path = $dialog.querySelector('#dlg-copy-path').value;
        if (!path.trim().replace(/\//g, '')) {
          event.keepDialogOpen = true;
          Toast.error('Give the copy an address');
          return;
        }
        const [saveError] = await this.persist();
        if (saveError) {
          event.keepDialogOpen = true;
          Toast.error(saveError.msg || 'Failed to save page');
          return;
        }
        const [error, copied] = await copyPage({ file: this.file, newFile: toFile(path) });
        if (error) {
          event.keepDialogOpen = true;
          Toast.error(error.msg || 'Failed to copy page');
          return;
        }
        Toast.success('Page copied');
        setTimeout(() => {
          window.location.href = `/admin/content/pages/edit?path=${encodeURIComponent(copied.file.replace(/\.page\.html$/, ''))}`;
        }, 800);
      }
    });
  };

  /* Publishing a draft: this page takes the place of another one, which is deleted. */
  handleReplace = async () => {
    const [, listing] = await listPages({ showHidden: true, limit: 500 });
    const pages = (listing?.pages || []).map(page => page.file).filter(file => file && file !== this.file);
    const $dialog = Dialog.create(html`
      <div class="p">
        <label class="d-b mbq" for="dlg-replace-path">The page to replace<small class="d-b tc-muted">This page moves to that address and the page that is there now is deleted. If this page is a draft, that is how it is published.</small></label>
        <input type="text" id="dlg-replace-path" class="full" list="dlg-replace-list" placeholder="/about">
        <datalist id="dlg-replace-list">${pages.map(file => html`<option value="/${file.replace(/\.page\.html$/, '')}"></option>`)}</datalist>
      </div>
    `, {
      title: 'Replace another page',
      confirmText: 'Replace the page',
      cancelText: 'Cancel',
      confirmAction: event => {
        const path = $dialog.querySelector('#dlg-replace-path').value;
        if (!path.trim().replace(/\//g, '')) {
          event.keepDialogOpen = true;
          Toast.error('Enter the address of the page to replace');
          return;
        }
        const target = toFile(path);
        Dialog.confirm(`Replace /${target.replace(/\.page\.html$/, '')} with this page? The page that is there now will be deleted. This cannot be undone.`, async confirmed => {
          if (!confirmed) return;
          const [saveError] = await this.persist();
          if (saveError) {
            Toast.error(saveError.msg || 'Failed to save page');
            return;
          }
          const [error, moved] = await movePage({ file: this.file, newFile: target, overwrite: true });
          if (error) {
            Toast.error(error.msg || 'Failed to replace the page');
            return;
          }
          Toast.success('Page replaced');
          setTimeout(() => {
            window.location.href = `/admin/content/pages/edit?path=${encodeURIComponent(moved.file.replace(/\.page\.html$/, ''))}`;
          }, 800);
        }, { title: 'Replace page' });
      }
    });
  };

  handleReset = () => {
    Dialog.confirm('Reset this page? Any unsaved changes will be lost.', async confirmed => {
      if (!confirmed) return;
      await this.load();
    });
  };

  handleSave = async () => {
    this.saving = true;
    const state = this.getFormState();
    const [saveError, saved] = await this.persist();
    this.saving = false;

    if (saveError) {
      if (saveError.code === 409 || /changed after you opened/i.test(saveError.msg || '')) {
        Dialog.confirm('This page was changed somewhere else after you opened it, so it was not saved. Reload it to see what changed? Your unsaved changes here will be lost.', confirmed => {
          if (confirmed) this.load();
        }, { title: 'The page changed' });
        return;
      }
      Toast.error(saveError.msg || 'Failed to save page');
      return;
    }

    const templateChanged = state.template !== this.page.template;
    this.metaDirty = false;
    this.codeDirty = false;
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
    if (templateChanged && this.inBuilder) await this.load();
  };

  /*
    The page's settings and its code locations, edited from the builder's control bar. They are kept here and saved with
    the page, like the builder's own tree.
  */

  /* The page's settings are edited in the builder's right panel when no widget is selected. */
  setMeta = changes => {
    this.meta = { ...this.meta, ...changes };
    this.metaDirty = true;
  };

  /* The templates this page can use, as { name, label }; the page's own is listed even when it is gone. */
  templateChoices = () => {
    const pageDir = this.file.replace(/\.page\.html$/, '').split('/').slice(0, -1).join('/') || '.';
    const choices = this.templates
      .filter(template => {
        const templateDir = template.directory === '.' ? '' : template.directory;
        const dir = pageDir === '.' ? '' : pageDir;
        return templateDir === '' || dir === templateDir || dir.startsWith(templateDir + '/');
      })
      .map(template => ({ name: template.name, label: template.directory === '.' ? `/${template.name}` : `/${template.directory}/${template.name}` }));
    if (!choices.some(choice => choice.name === this.meta.template)) choices.unshift({ name: this.meta.template, label: `${this.meta.template} (Not Found, using default)` });
    return choices;
  };

  openCode = location => {
    const block = this.contents.find(content => content.location === location);
    if (!block) return;
    const title = location === 'head' ? 'Head' : location;
    const $dialog = Dialog.create(html`
      <div class="p">
        <p class="tc-muted">Code placed in the page's head. It is saved with the page and is not changed by the builder.</p>
        <k-code-editor id="dlg-code" class="r b" language="html" controls="normal" .value="${/^\s*(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)?$/i.test(block.content) ? '' : block.content}"></k-code-editor>
      </div>
    `, {
      title,
      confirmText: 'Apply',
      cancelText: 'Cancel',
      width: 'min(70rem, 95vw)',
      confirmAction: () => {
        const value = $dialog.querySelector('#dlg-code').getValue();
        if (value === block.content) return;
        this.contents = this.contents.map(content => (content.location === location ? { ...content, content: value } : content));
        this.codeDirty = true;
      }
    });
  };

  /*
    The builder and the file disagree
  */

  showConflict() {
    const { conflict } = this.builder;
    const choose = async keep => {
      $dialog.close();
      const [error, result] = await resolveSitebuilderConflict({ file: this.file, keep, loadedHash: this.builder.hash });
      if (error) {
        Toast.error(error.msg || 'The choice could not be saved');
        return;
      }
      this.builder = result;
      Toast.success(keep === 'file' ? 'Kept the file' : 'Kept the builder\'s copy');
    };
    const when = value => (value ? new Date(value).toLocaleString() : 'unknown');
    const $dialog = Dialog.create(html`
      <div class="p">
        <p>This page's file was changed outside the page builder, so it no longer matches the builder's copy. Choose which one to keep. The other is replaced, and both are saved to match.</p>
        ${conflict.fileRebuildable ? '' : html`<p class="r p bc-warning tc-warning">The builder cannot edit the file's version (${conflict.fileReason}). If you keep it, this page can only be edited as code. The builder's last version is kept in case you want to go back to it.</p>`}
        <div class="d-f" style="gap: var(--spacer); align-items: stretch;">
          <div class="flex">
            <h6 class="mb0">The file</h6>
            <p class="tc-muted mbq">Changed ${when(conflict.fileModifiedAt)}</p>
            <iframe title="The file's version" class="full b r" style="height: 22rem;" sandbox="allow-scripts allow-same-origin" srcdoc="${previewDocument(conflict.filePreview)}"></iframe>
            <button class="primary full mt" @click="${() => choose('file')}">Keep the file</button>
          </div>
          <div class="flex">
            <h6 class="mb0">The builder's copy</h6>
            <p class="tc-muted mbq">Saved ${when(conflict.rowSavedAt)}</p>
            <iframe title="The builder's version" class="full b r" style="height: 22rem;" sandbox="allow-scripts allow-same-origin" srcdoc="${previewDocument(conflict.rowPreview)}"></iframe>
            <button class="primary full mt" @click="${() => choose('row')}">Keep the builder's copy</button>
          </div>
        </div>
      </div>
    `, {
      title: 'This page was changed outside the builder',
      closeBtn: false,
      overlayClose: false,
      disableKeyboardClose: true,
      width: 'min(70rem, 95vw)'
    });
  }

  /*
    Going from code back to the builder: either the page is wiped, or the builder's last good version comes back
  */

  handleUseBuilder = async () => {
    this.saving = true;
    await this.openBuilder();
    this.saving = false;
    if (this.inBuilder) {
      Toast.success('This page can be edited in the builder');
      return;
    }
    if (this.builder?.state !== 'code') return;
    const leave = async mode => {
      $dialog.close();
      const [error, result] = await leaveSitebuilderCodeMode({ file: this.file, mode, loadedHash: this.builder.hash });
      if (error) {
        Toast.error(error.msg || 'The page could not be moved to the builder');
        return;
      }
      await this.load();
      Toast.success('This page is now edited in the builder');
    };
    const $dialog = Dialog.create(html`
      <div class="p">
        <p>The builder cannot edit this page as it is${this.builder.reason ? html` (${this.builder.reason})` : ''}. To use the builder, the page's content has to be replaced.</p>
        <button class="danger full mb" @click="${() => leave('empty')}">Start over with an empty page</button>
        ${this.builder.hasLastGood ? html`<button class="primary full mb" @click="${() => leave('lastGood')}">Start from the last good builder page</button>` : ''}
        <p class="tc-muted">Your head is kept. The current content of the page is lost.</p>
      </div>
    `, { title: 'Use the page builder', cancelText: 'Cancel' });
  };

  /*
    Render
  */

  renderContentTab({ location, label, content, orphaned }, isLocked) {
    const isDefault = location === 'default';
    const headerTitle = label || (isDefault ? 'Content' : location.slice(0, 1).toUpperCase() + location.slice(1));
    const editorTag = unsafeStatic(getComponentOverride('page-content-editor', 'k-html-editor'));
    const extensions = CODE_MODE_LOCATIONS.has(location) ? { nodes: [], controls: [] } : getEditorExtensions();
    const codeMode = CODE_MODE_LOCATIONS.has(location) || this.builder?.state === 'code';
    return html`
      <k-tab for="content-${location}">
        ${headerTitle}${orphaned ? html` <span class="tc-warning"><small>(not in template)</small></span>` : ''}
      </k-tab>
      <k-tab-content name="content-${location}">
        <div class="p">
          ${staticHtml`<${editorTag}
            class="r b"
            data-location="${location}"
            controls="full"
            .value="${content}"
            mode="${codeMode ? 'code' : 'visual'}"
            nodes="${extensions.nodes.join(',')}"
            ?disabled="${isLocked}"
          >${extensions.controls.map(control => staticHtml`<${unsafeStatic(control)} slot="toolbar-top-extra"></${unsafeStatic(control)}>`)}</${editorTag}>`}
        </div>
      </k-tab-content>
    `;
  }

  render() {
    if (this.loading) return html`<div>Loading page...</div>`;
    const inBuilder = this.inBuilder;
    const defaultTab = this.contents.some(content => content.location === 'default') ? 'content-default' : 'metadata';

    if (this.error) return html`
      <div>
        <p>Page not found.</p>
        <a href="/admin/pages">Back to Pages</a>
      </div>
    `;

    const { page, templates, contents } = this;
    const isSystem = page.owner === 'system';
    const isLocked = page.locked;

    if (this.builder?.state === 'conflict') return html`
      <h1 class="mb0">Page: ${page.name || page.title || this.file}</h1>
      <p class="tc-muted">Choose which version of this page to keep to continue.</p>
    `;

    if (inBuilder) return html`<admin-page-builder .data="${this.builder}" .host="${this}" .saving="${this.saving}" .meta="${this.meta}"></admin-page-builder>`;

    return html`
      ${isLocked ? html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This page is locked and cannot be edited. ${page.owner === 'custom' ? 'Locked by developer' : `Managed by: ${page.owner || 'external system'}`}
        </div>
      ` : ''}
      ${this.builder?.state === 'code' ? html`
        <div class="p r mb bc-warning d-f" style="align-items: center; gap: var(--spacer);">
          <span class="flex"><k-icon name="code"></k-icon> This page is edited as code${this.builder.reason ? html`: ${this.builder.reason}` : ''}.</span>
          ${!isLocked ? html`<button ?disabled="${this.saving}" @click="${this.handleUseBuilder}">Use the page builder</button>` : ''}
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
        <div class="btn-grp mrh mb">
          ${!isSystem && !isLocked ? html`
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Page</button>
          ` : ''}
          <button @click="${this.handleCopy}"><k-icon name="content_copy"></k-icon> Copy Page</button>
          ${!isSystem && !isLocked ? html`<button @click="${this.handleReplace}"><k-icon name="repeat"></k-icon> Replace Page</button>` : ''}
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
      <h1 class="mb0">Page: ${page.name || page.title || this.file}</h1>

      <a href="${this.getPageUrl()}" class="d-b mb"><code>${this.getPageUrl()}</code></a>

      <k-tabs active="${defaultTab}">
        <k-tab for="metadata">Metadata</k-tab>
        <k-tab-content name="metadata">
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
              ${(() => {
                const pageDir = this.file.replace(/\.page\.html$/, '').split('/').slice(0, -1).join('/') || '.';
                const reachable = templates.filter(t => {
                  const tDir = t.directory === '.' ? '' : t.directory;
                  const pDir = pageDir === '.' ? '' : pageDir;
                  return tDir === '' || pDir === tDir || pDir.startsWith(tDir + '/');
                });
                const templateLabel = t => t.directory === '.' ? `/${t.name}` : `/${t.directory}/${t.name}`;
                const currentFound = reachable.some(t => t.name === page.template);
                return html`
                  <select id="metaTemplate" class="flex" @change="${this.handleTemplateChange}" ?disabled="${isLocked}">
                    ${!currentFound ? html`<option value="${page.template}" selected>${page.template} (Not Found, using default)</option>` : ''}
                    ${reachable.map(t => html`
                      <option value="${t.name}" ?selected="${t.name === page.template}">${templateLabel(t)}</option>
                    `)}
                  </select>
                `;
              })()}
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
        </k-tab-content>
        ${Object.keys(page.extraMetadata || {}).length ? html`
          <k-tab for="extra-metadata">Extra Metadata</k-tab>
          <k-tab-content name="extra-metadata">
            <div class="p">
              ${Object.entries(page.extraMetadata).map(([key, value]) => html`
                <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                  <label style="min-width: 120px;" class="muted"><strong>${key}</strong></label>
                  <span>${value}</span>
                </div>
              `)}
              <p class="muted mt0"><small>Extra metadata is managed by extensions and cannot be edited here.</small></p>
            </div>
          </k-tab-content>
        ` : ''}
        ${repeat(contents, c => c.location, content => this.renderContentTab(content, isLocked))}
      </k-tabs>
    `;
  }
}

customElements.define('admin-page-editor', PageEditor);
