import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css, render } from '/kempo-ui/lit-all.min.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import { getSitebuilderWidgets, listFragments, listSitebuilderTemplates, createSitebuilderTemplate, deleteSitebuilderTemplate } from '/kempo/sdk.js';
import { buildRegistry } from '/kempo/sitebuilder/registry.js';
import History from '/kempo/sitebuilder/history.js';
import { cloneNode, findNode, isInside } from '/kempo/sitebuilder/nodes.js';
import { canContain } from '/kempo/sitebuilder/render.js';
import { acceptingSlot, addWidget, duplicateWidgets, freshCopies, insertNodes, moveBy, moveIn, moveOut, moveWidget, neighbour, removeWidgets, sharePlace } from '/kempo/sitebuilder/ops.js';
import Frame from './frame.js';
import './SitebuilderTree.js';
import './SitebuilderAttributes.js';
import './SitebuilderInserter.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Toggle.js';
import '/kempo-ui/components/Dropdown.js';

const SETTINGS_KEY = 'sitebuilder:settings';
const DEVICES = [['phone', 'Phone', 'smartphone'], ['tablet', 'Tablet', 'tablet'], ['desktop', 'Desktop', 'desktop']];
const QUIET = /^Already /;

const readSettings = () => {
  try {
    return { confirmDeletion: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { confirmDeletion: false };
  }
};

/*
  The page editor: a control bar, the widget tree on the left, the page in the middle and the selected widget's
  settings on the right.

  It is given `data` (what the server returned when the page was opened) and `host`, the page editor around it, whose
  save() writes the page. It owns the working copy of the trees: every change goes through change(), which keeps the
  undo history (browser only, at most 50 steps) and shows the result in the page. Saving is the host's job; the host
  asks for getTrees() and, once the server has stored them, calls markSaved().
*/
export default class Sitebuilder extends ShadowComponent {
  static properties = {
    data: { attribute: false },
    host: { attribute: false },
    meta: { attribute: false },
    saving: { type: Boolean },
    ready: { state: true },
    location: { state: true },
    selection: { state: true },
    treeOpen: { state: true },
    attrsOpen: { state: true },
    device: { state: true },
    version: { state: true }
  };

  constructor(){
    super();
    this.ready = false;
    this.location = 'default';
    this.selection = [];
    this.treeOpen = true;
    this.attrsOpen = true;
    this.device = 'desktop';
    this.version = 0;
    this.saving = false;
    this.trees = {};
    this.savedJson = '';
    this.history = new History();
    this.coalesceKey = null;
    this.coalesceTime = 0;
    this.variables = [];
    this.fragments = [];
    this.settings = readSettings();
  }

  static styles = css`
    :host { display: block; height: 100%; }
    .sb { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--c_border, #8884); }
    .bar .spacer { flex: 1; }
    .bar select { width: auto; align-self: stretch; }
    .menu { display: flex; flex-direction: column; min-width: 14rem; padding: 0.25rem; }
    .menu button { text-align: left; border: 0; }
    .body { display: flex; flex: 1; min-height: 0; }
    aside { overflow: auto; flex: none; }
    aside.tree { width: 18rem; border-right: 1px solid var(--c_border, #8884); }
    aside.attrs { width: 22rem; border-left: 1px solid var(--c_border, #8884); }
    .canvas { flex: 1; min-width: 0; overflow: auto; background: var(--c_bg__alt, #8881); }
    iframe { display: block; width: 100%; height: 100%; border: 0; background: var(--c_bg, #fff); margin: 0 auto; }
    .tablet iframe { width: 768px; max-width: 100%; }
    .phone iframe { width: 390px; max-width: 100%; }
    .loading { padding: 2rem; text-align: center; }
  `;

  /*
    Lifecycle
  */

  connectedCallback(){
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  disconnectedCallback(){
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  async updated(changed){
    super.updated(changed);
    if(changed.has('data') && this.data && !this.ready) await this.start();
  }

  async start(){
    const [, widgets] = await getSitebuilderWidgets();
    this.registry = buildRegistry(widgets?.widgets || []);
    this.variables = this.data.page?.variables || [];
    this.trees = structuredClone(this.data.trees || {});
    const visual = this.visualLocations();
    this.location = visual[0]?.name || 'default';
    for(const { name } of visual) this.trees[name] = this.trees[name] || [];
    this.savedJson = JSON.stringify(this.trees);
    this.frame = new Frame(this.renderRoot.querySelector('iframe'), this.registry, {
      onSelect: (id, options) => this.select(id, options),
      onBlank: () => this.setSelection([]),      onText: (id, attribute, value) => this.setAttribute(id, attribute, value, true, false),
      onCell: (id, row, column, value) => this.setCell(id, row, column, value),
      onChange: (id, changes) => this.change(nodes => { Object.assign(findNode(nodes, id).node.attrs, changes); return true; }, { coalesce: `${id}:widget`, render: false }),
      onDrop: (id, place) => this.moveTo(id, place, true),
      restricted: id => !!this.registry.get(this.find(id)?.node.type)?.only_in?.length,
      canDrop: (id, parentId, slot) => {
        const dragged = this.find(id);
        if(!dragged || (parentId && (parentId === id || isInside(this.nodes, id, parentId)))) return false;
        return canContain(this.registry, parentId ? this.find(parentId)?.node : null, slot, dragged.node.type);
      },
      onKeyDown: this.handleKeyDown,
      locate: id => this.locate(id)
    });
    this.ready = true;
    await this.frame.render(this.nodes, this.selection);
    listFragments().then(([, result]) => {
      this.fragments = (result?.fragments || []).map(fragment => fragment.name || String(fragment.file || '').replace(/\.fragment\.html$/, '')).filter(Boolean);
      this.requestUpdate();
    });
  }

  /*
    State
  */

  visualLocations(){
    return (this.data?.locations || []).filter(location => !location.code);
  }

  get nodes(){
    this.trees[this.location] = this.trees[this.location] || [];
    return this.trees[this.location];
  }

  get dirty(){
    return this.ready && (JSON.stringify(this.trees) !== this.savedJson || !!this.host?.extrasDirty);
  }

  find = id => (id ? findNode(this.nodes, id) : null);

  locate = id => {
    const found = this.find(id);
    return found ? { parentId: found.parent?.id ?? null, slot: found.slot, index: found.index } : null;
  };

  getTrees(){
    return structuredClone(this.trees);
  }

  markSaved(trees){
    if(trees){
      for(const [name, nodes] of Object.entries(trees)) this.trees[name] = nodes;
    }
    this.savedJson = JSON.stringify(this.trees);
    this.prune();
    this.refresh();
  }

  refresh(){
    this.version++;
    this.frame?.render(this.nodes, this.selection);
  }

  prune(){
    const live = this.selection.filter(id => this.find(id));
    if(live.length !== this.selection.length) this.selection = live;
  }

  /*
    Every change to the page goes through here. `mutate` gets the current location's nodes and returns true, a string
    (why it could not), `{ error }`, or `{ select: [ids] }` to select something afterwards. A failed change leaves the
    page as it was.
  */
  change(mutate, { coalesce = null, render: show = true } = {}){
    const before = structuredClone(this.trees);
    const result = mutate(this.nodes);
    const reason = typeof result === 'string' ? result : result?.error;
    if(reason){
      this.trees = before;
      if(!QUIET.test(reason)) Toast.error(reason);
      return false;
    }
    const now = Date.now();
    if(!(coalesce && this.coalesceKey === coalesce && now - this.coalesceTime < 1000)) this.history.push(before);
    this.coalesceKey = coalesce;
    this.coalesceTime = now;
    if(result?.select) this.selection = result.select;
    this.prune();
    if(show) this.refresh();
    else this.version++;
    return true;
  }

  /*
    Selection
  */

  select = (id, { additive = false } = {}) => {
    let next = [id];
    if(additive){
      if(this.selection.includes(id)) next = this.selection.filter(other => other !== id);
      else if(sharePlace(this.nodes, [...this.selection, id])) next = [...this.selection, id];
    }
    this.setSelection(next);
  };

  setSelection(ids){
    this.selection = ids;
    this.frame?.setSelection(ids);
    if(ids[0]) this.frame?.scrollTo(ids[0]);
    this.version++;
  }

  /* For a widget's own settings component: adds a new widget inside the one with this id, leaving the selection alone. */
  addChild = (parentId, type, slot = 'default') => {
    this.change(nodes => {
      const result = addWidget(nodes, this.registry, type, { targetId: parentId, inside: true, slot });
      return result.error ? result : true;
    });
  };

  /* A click in the tree that is not on a widget selects nothing, which shows the page's settings. */
  handleTreeClick = event => {
    if(event.composedPath().some(element => element.matches?.('.row, button'))) return;
    this.setSelection([]);
  };

  selectParent = () => {
    const parent = this.selection.length === 1 ? this.find(this.selection[0])?.parent : null;
    this.setSelection(parent ? [parent.id] : []);
  };

  /*
    Settings of a widget
  */

  setAttribute = (id, name, value, coalesce = false, show = true) => {
    this.change(nodes => {
      const { node } = findNode(nodes, id);
      node.attrs[name] = value;
      return true;
    }, { coalesce: coalesce ? `${id}:${name}` : null, render: show });
  };

  setCell(id, row, column, value){
    this.change(nodes => {
      const { node } = findNode(nodes, id);
      const rows = node.attrs.rows?.length ? node.attrs.rows : [['', ''], ['', '']];
      if(rows[row]) rows[row][column] = value;
      node.attrs.rows = rows;
      return true;
    }, { coalesce: `${id}:cell:${row},${column}`, render: false });
  }

  /*
    Adding
  */

  placement(){
    return { targetId: this.selection[this.selection.length - 1] ?? null };
  }

  canAdd = type => !addWidget(structuredClone(this.nodes), this.registry, type, this.placement()).error;

  openInserter = () => {
    const inserter = document.createElement('admin-sitebuilder-inserter');
    inserter.registry = this.registry;
    inserter.host = this;
    this.inserterDialog = Dialog.create(inserter, { title: 'Add a widget', cancelText: 'Close' });
  };

  insert = type => {
    this.inserterDialog?.close();
    this.change(nodes => {
      const result = addWidget(nodes, this.registry, type, this.placement());
      return result.error ? result : { select: [result.id] };
    });
  };

  /*
    Changing the page
  */

  remove = () => {
    if(!this.selection.length) return;
    const ids = [...this.selection];
    const run = () => this.change(nodes => {
      const next = neighbour(nodes, ids[0]);
      removeWidgets(nodes, ids);
      return { select: next && !ids.includes(next) ? [next] : [] };
    });
    if(this.settings.confirmDeletion) Dialog.confirm(`Delete ${ids.length > 1 ? `these ${ids.length} widgets` : 'this widget'}?`, confirmed => confirmed && run(), { title: 'Delete' });
    else run();
  };

  moveUp = () => this.selection.length && this.change(nodes => moveBy(nodes, this.registry, this.selection, -1));

  moveDown = () => this.selection.length && this.change(nodes => moveBy(nodes, this.registry, this.selection, 1));

  moveOutOf = () => this.selection.length === 1 && this.change(nodes => moveOut(nodes, this.registry, this.selection[0]));

  moveInto = () => this.selection.length === 1 && this.change(nodes => moveIn(nodes, this.registry, this.selection[0]));

  duplicate = () => {
    if(!this.selection.length) return;
    this.change(nodes => {
      const result = duplicateWidgets(nodes, this.selection);
      return result.error ? result : { select: result.ids };
    });
  };

  moveTo(id, place, keepSelection = false){
    this.change(nodes => {
      const result = moveWidget(nodes, this.registry, id, place.parentId, place.slot, place.index);
      return result === true && !keepSelection ? { select: [id] } : result;
    });
  }

  /* From the widget tree: a row was dropped before, after or into another. */
  dropOn = (draggedId, targetId, zone) => {
    const target = this.find(targetId);
    const dragged = this.find(draggedId);
    if(!target || !dragged) return;
    if(zone === 'inside'){
      const slot = acceptingSlot(this.registry, target.node, dragged.node.type);
      if(!slot) return;
      this.moveTo(draggedId, { parentId: targetId, slot, index: Infinity });
      return;
    }
    this.dropNear(draggedId, targetId, zone === 'before');
  };

  /*
    Puts a widget just before or after another. Where the target's own list will not take it (a section of an accordion
    takes only sections) it goes next to the nearest parent that does.
  */
  dropNear(draggedId, targetId, before){
    const dragged = this.find(draggedId);
    if(!dragged || draggedId === targetId || isInside(this.nodes, draggedId, targetId)) return;
    let found = this.find(targetId);
    while(found){
      if(canContain(this.registry, found.parent, found.slot, dragged.node.type)){
        this.moveTo(draggedId, { parentId: found.parent?.id ?? null, slot: found.slot, index: found.index + (before ? 0 : 1) });
        return;
      }
      found = found.parent ? this.find(found.parent.id) : null;
    }
    Toast.error(`${this.registry.get(dragged.node.type)?.title ?? 'That widget'} cannot go there`);
  }

  undo = () => {
    const previous = this.history.undo(this.trees);
    if(!previous) return;
    this.trees = previous;
    this.coalesceKey = null;
    this.prune();
    this.refresh();
  };

  redo = () => {
    const next = this.history.redo(this.trees);
    if(!next) return;
    this.trees = next;
    this.coalesceKey = null;
    this.prune();
    this.refresh();
  };

  setLocation(name){
    this.location = name;
    this.setSelection([]);
    this.refresh();
  }

  /*
    Templates
  */

  saveTemplate = () => {
    if(!this.selection.length) {
      Toast.error('Select a widget to save as a template');
      return;
    }
    const nodes = this.selection.map(id => cloneNode(this.find(id).node)).filter(Boolean);
    const dialog = Dialog.create(html`
      <div class="p">
        <label class="d-b mbq" for="sb-template-name">Template name<small class="d-b tc-muted">Inserting a template makes a copy, so changing it later does not change the pages that used it.</small></label>
        <input id="sb-template-name" type="text" class="full" maxlength="100">
      </div>
    `, {
      title: 'Save as a template',
      confirmText: 'Save template',
      cancelText: 'Cancel',
      confirmAction: async event => {
        const input = dialog.querySelector('#sb-template-name');
        if(!input.value.trim()){
          event.keepDialogOpen = true;
          Toast.error('Give the template a name');
          return;
        }
        const [error] = await createSitebuilderTemplate({ name: input.value.trim(), nodes });
        if(error){
          event.keepDialogOpen = true;
          Toast.error(error.msg || 'The template could not be saved');
          return;
        }
        Toast.success('Template saved');
      }
    });
  };

  insertTemplate = async () => {
    const [error, data] = await listSitebuilderTemplates();
    if(error){
      Toast.error(error.msg || 'The templates could not be loaded');
      return;
    }
    let templates = data.templates;
    const container = document.createElement('div');
    const draw = () => render(html`
      <div class="p">
        ${templates.length ? templates.map(template => html`
          <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
            <span class="flex">${template.name}</span>
            <button class="primary" @click="${() => { dialog.close(); this.insertTemplateNodes(template); }}">Insert</button>
            <button class="danger" @click="${async () => {
              const [deleteError] = await deleteSitebuilderTemplate(template.id);
              if(deleteError){
                Toast.error(deleteError.msg || 'The template could not be deleted');
                return;
              }
              templates = templates.filter(other => other.id !== template.id);
              draw();
            }}">Delete</button>
          </div>
        `) : html`<p class="tc-muted">No templates yet. Select a widget and use Save as a template.</p>`}
      </div>
    `, container);
    draw();
    const dialog = Dialog.create(container, { title: 'Insert a template', cancelText: 'Close' });
  };

  insertTemplateNodes(template){
    this.change(nodes => {
      const copies = freshCopies(template.nodes);
      const result = insertNodes(nodes, this.registry, copies, this.placement());
      return result.error ? result : { select: result.ids };
    });
  }

  /*
    Settings of the editor
  */

  openSettings = () => {
    const container = document.createElement('div');
    const draw = () => render(html`
      <div class="p">
        <div class="d-f" style="align-items: center; gap: var(--spacer);">
          <k-toggle id="sb-setting-confirm" .value="${this.settings.confirmDeletion}" @change="${event => {
            this.settings = { ...this.settings, confirmDeletion: event.detail.value };
            try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* the setting just does not persist */ }
          }}"></k-toggle>
          <label for="sb-setting-confirm">Confirm deletion<small class="d-b tc-muted">Ask before the Delete key or the remove button deletes a widget.</small></label>
        </div>
      </div>
    `, container);
    draw();
    Dialog.create(container, { title: 'Editor settings', cancelText: 'Close' });
  };

  /*
    Keyboard
  */

  openShortcuts = () => {
    const rows = [
      ['Click', 'Select the outermost widget under the pointer. Each click inside it selects the next widget down, and clicking the selected widget edits its text.'],
      ['Shift or Ctrl + click', 'Add the widget beside the selected one (same parent) to the selection.'],
      ['Drag the handle', 'Move the selected widget: drop it in a box that shows on the page. Letting go anywhere else cancels.'],
      ['Ctrl + S', 'Save the page.'],
      ['Ctrl + D', 'Duplicate the selected widgets.'],
      ['Ctrl + Z', 'Undo.'],
      ['Ctrl + Shift + Z, Ctrl + Shift + Y or Ctrl + Y', 'Redo.'],
      ['Delete or Backspace', 'Delete the selected widgets.'],
      ['Escape', 'Stop typing and keep the widget selected. Pressed again, select its parent, and at the top of the page select nothing, which shows the page settings.'],
      ['Alt + Shift + Up or Down', 'Move the selection up or down.'],
      ['Alt + Shift + Left', 'Move the selection out of its parent.'],
      ['Alt + Shift + Right', 'Move the selection into the widget before it.']
    ];
    Dialog.create(html`
      <div class="p">
        <p class="tc-muted">On a Mac, Ctrl means Cmd. Inside text the browser's own shortcuts work (Ctrl + B and the rest), and Ctrl + Z and Delete stay the text's own, so one key never does two things.</p>
        <table>
          <thead><tr><th>Keys</th><th>Does</th></tr></thead>
          <tbody>${rows.map(([keys, does]) => html`<tr><td><strong>${keys}</strong></td><td>${does}</td></tr>`)}</tbody>
        </table>
      </div>
    `, { title: 'Keyboard shortcuts', cancelText: 'Close', width: 'min(48rem, 95vw)' });
  };

  /*
    Whether a key is for the text under the cursor, not for the selected widget. A widget on the page that is not the
    selection (the text inside a Column that was just selected still has the cursor) is not being typed into: the
    selected widget is what the keys act on.
  */
  isTyping(event){
    const path = event.composedPath();
    const widget = path.find(element => element.dataset?.sbId);
    if(widget && !this.selection.includes(widget.dataset.sbId)) return false;
    return path.some(element => element.matches?.('input, textarea, select, [contenteditable]') || element.tagName === 'K-HTML-EDITOR');
  }

  handleKeyDown = event => {
    if(!this.ready) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const typing = this.isTyping(event);

    if(mod && key === 's'){
      event.preventDefault();
      this.host?.save();
      return;
    }
    if(mod && key === 'd' && this.selection.length){
      event.preventDefault();
      this.duplicate();
      return;
    }
    if(mod && !event.altKey && (key === 'z' || key === 'y')){
      if(typing) return;
      event.preventDefault();
      if(key === 'y' || event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if(event.altKey && event.shiftKey && key.startsWith('arrow')){
      event.preventDefault();
      if(key === 'arrowup') this.moveUp();
      else if(key === 'arrowdown') this.moveDown();
      else if(key === 'arrowleft') this.moveOutOf();
      else this.moveInto();
      return;
    }
    if(key === 'escape'){
      if(typing){
        document.activeElement?.blur?.();
        this.frame?.blurFocus();
        return;
      }
      this.selectParent();
      return;
    }
    if((key === 'delete' || key === 'backspace') && !typing && this.selection.length){
      event.preventDefault();
      this.remove();
    }
  };

  handleBeforeUnload = event => {
    if(!this.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  };

  /*
    Render
  */

  /* One control bar: panels at either end, the page's own actions, what is done to widgets, the preview, undo and save. */
  renderBar(){
    const host = this.host;
    const single = this.selection.length === 1;
    const any = this.selection.length > 0;
    const visual = this.visualLocations();
    const system = host?.page?.owner === 'system';
    const codeLocations = (this.data?.locations || []).filter(location => location.code).map(location => location.name);
    const iconButton = (name, label, action, { disabled = false, direction = '', className = '' } = {}) => html`<button class="${className}" title="${label}" aria-label="${label}" ?disabled="${disabled}" @click="${action}"><k-icon name="${name}" direction="${direction}"></k-icon></button>`;
    const item = (icon, label, action, className = '') => html`<button data-value="${label}" class="${className}" @click="${action}"><k-icon name="${icon}"></k-icon> ${label}</button>`;
    return html`
      <div class="bar">
        ${iconButton('account_tree', `${this.treeOpen ? 'Hide' : 'Show'} the widget tree`, () => { this.treeOpen = !this.treeOpen; }, { className: this.treeOpen ? 'primary' : '' })}
        <div class="btn-grp">
          <a href="/admin/content/pages" class="btn" title="Back to the pages" aria-label="Back to the pages"><k-icon name="arrow" direction="left"></k-icon></a>
          <a href="${host.getPageUrl()}" target="_blank" rel="noopener" class="btn" id="page-link" title="Open the page in a new tab" aria-label="Open the page in a new tab"><k-icon name="open_in_browser"></k-icon></a>
        </div>
        <div class="btn-grp">
          ${iconButton('add', 'Add a widget', this.openInserter, { className: 'primary' })}
          ${iconButton('delete', 'Delete', this.remove, { disabled: !any })}
          ${iconButton('arrow', 'Move up', this.moveUp, { disabled: !any, direction: 'up' })}
          ${iconButton('arrow', 'Move down', this.moveDown, { disabled: !any, direction: 'down' })}
          ${iconButton('arrow', 'Move into the widget before it', this.moveInto, { disabled: !single, direction: 'right' })}
          ${iconButton('arrow', 'Move out of its parent', this.moveOutOf, { disabled: !single, direction: 'left' })}
        </div>
        <div class="btn-grp">
          ${iconButton('content_copy', 'Duplicate (Ctrl+D)', this.duplicate, { disabled: !any })}
          <k-dropdown open-direction="down left">
            ${item('save', 'Save template', this.saveTemplate)}
            ${item('folder-open', 'Insert template', this.insertTemplate)}
            <button slot="trigger" title="Templates" aria-label="Templates"><k-icon name="dashboard"></k-icon></button>
          </k-dropdown>
        </div>
        <div class="btn-grp">
          ${DEVICES.map(([name, label, icon]) => iconButton(icon, `Preview on a ${label.toLowerCase()}`, () => { this.device = name; this.frame?.placeHandle(); }, { className: this.device === name ? 'primary' : '' }))}
        </div>
        ${visual.length > 1 ? html`
          <select aria-label="Content area" @change="${event => this.setLocation(event.target.value)}">
            ${visual.map(location => html`<option value="${location.name}" ?selected="${location.name === this.location}">${location.label || (location.name === 'default' ? 'Content' : location.name)}</option>`)}
          </select>
        ` : ''}
        <span class="spacer"></span>
        <div class="btn-grp">
          ${iconButton('undo', 'Undo (Ctrl+Z)', this.undo, { disabled: !this.history.canUndo })}
          ${iconButton('redo', 'Redo (Ctrl+Shift+Z)', this.redo, { disabled: !this.history.canRedo })}
        </div>
        ${iconButton('save', this.dirty ? 'Save the page (Ctrl+S). There are unsaved changes.' : 'Save the page (Ctrl+S)', () => host.save(), { disabled: this.saving, className: this.dirty ? 'primary' : '' })}
        <k-dropdown open-direction="down left">
          <button slot="trigger" title="More" aria-label="More"><k-icon name="more_vert"></k-icon></button>
          ${codeLocations.includes('head') ? item('code', 'Head code', () => host.openCode('head')) : ''}
          ${codeLocations.includes('scripts') ? item('code', 'Scripts code', () => host.openCode('scripts')) : ''}
          ${item('settings', 'Editor settings', this.openSettings)}
          ${item('keyboard', 'Keyboard shortcuts', this.openShortcuts)}
          ${item('content_copy', 'Copy page', host.handleCopy)}
          ${system ? '' : item('drive_file_move', 'Move page', host.handleMove)}
          ${system ? '' : item('repeat', 'Replace another page', host.handleReplace)}
          ${item('restart_alt', 'Reset', host.handleReset)}
          ${system ? '' : item('delete', 'Delete page', host.handleDelete, 'tc-danger')}
        </k-dropdown>
        ${iconButton('tune', `${this.attrsOpen ? 'Hide' : 'Show'} the widget settings`, () => { this.attrsOpen = !this.attrsOpen; }, { className: this.attrsOpen ? 'primary' : '' })}
      </div>
    `;
  }

  render(){
    const single = this.selection.length === 1 ? this.find(this.selection[0])?.node : null;
    return html`
      <div class="sb">
        ${this.ready ? this.renderBar() : ''}
        <div class="body">
          ${this.ready && this.treeOpen ? html`<aside class="tree" @click="${this.handleTreeClick}"><admin-sitebuilder-tree .nodes="${this.nodes}" .registry="${this.registry}" .selection="${this.selection}" .host="${this}"></admin-sitebuilder-tree></aside>` : ''}
          <div class="canvas ${this.device}">
            ${this.ready ? '' : html`<div class="loading">Loading the editor</div>`}
            <iframe title="Page content" ?hidden="${!this.ready}"></iframe>
          </div>
          ${this.ready && this.attrsOpen ? html`<aside class="attrs"><admin-sitebuilder-attributes .node="${single}" .count="${this.selection.length}" .meta="${this.meta}" .version="${this.version}" .registry="${this.registry}" .host="${this}"></admin-sitebuilder-attributes></aside>` : ''}
        </div>
      </div>
    `;
  }
}

customElements.define('admin-sitebuilder', Sitebuilder);
