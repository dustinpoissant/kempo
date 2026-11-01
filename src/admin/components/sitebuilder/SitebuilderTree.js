import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import { slotsOf } from '/kempo/sitebuilder/render.js';
import { acceptingSlot } from '/kempo/sitebuilder/ops.js';
import { hintOf, titleOf } from './labels.js';
import '/kempo-ui/components/Icon.js';

/*
  The widget tree: the page's widgets, nested the way they are on the page. Clicking a row selects it (shift or ctrl to
  select several), and rows can be dragged to move a widget. It shows what `host` (the sitebuilder) tells it and calls
  the host's methods; it keeps no copy of the page.
*/
export default class SitebuilderTree extends ShadowComponent {
  static properties = {
    nodes: { attribute: false },
    registry: { attribute: false },
    selection: { attribute: false },
    host: { attribute: false },
    collapsed: { state: true },
    dropAt: { state: true }
  };

  constructor(){
    super();
    this.nodes = [];
    this.selection = [];
    this.collapsed = new Set();
    this.dropAt = null;
    this.dragId = null;
  }

  static styles = css`
    :host { display: block; }
    ul { list-style: none; margin: 0; padding: 0; }
    ul ul { padding-left: 1rem; }
    .row { display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.375rem; border-radius: 0.25rem; cursor: pointer; border: 1px solid transparent; }
    .row:hover { background: var(--c_bg__alt, #8881); }
    .row.selected { background: var(--c_primary, #36f); color: #fff; }
    .row.before { border-top-color: var(--c_primary, #36f); }
    .row.after { border-bottom-color: var(--c_primary, #36f); }
    .row.inside { border-color: var(--c_primary, #36f); }
    .hint { opacity: 0.65; font-size: 0.85em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .slot { font-size: 0.8em; opacity: 0.6; padding: 0.25rem 0.375rem 0; }
    .twisty { width: 1rem; flex: none; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; }
    .empty { padding: 0.75rem; opacity: 0.6; }
  `;

  updated(changed){
    if(changed.has('selection') && this.selection?.length){
      this.renderRoot.querySelector('.row.selected')?.scrollIntoView({ block: 'nearest' });
    }
  }

  /*
    Dragging
  */

  zoneOf(event, row, id){
    const rect = row.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    const found = this.host.find(id);
    const container = found && acceptingSlot(this.registry, found.node, this.dragType()) !== null;
    if(ratio < 0.3) return 'before';
    if(ratio > 0.7) return 'after';
    return container ? 'inside' : (ratio < 0.5 ? 'before' : 'after');
  }

  dragType(){
    return this.host.find(this.dragId)?.node.type;
  }

  handleDragStart = (event, id) => {
    this.dragId = id;
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
  };

  handleDragOver = (event, id) => {
    if(!this.dragId || id === this.dragId) return;
    event.preventDefault();
    this.dropAt = { id, zone: this.zoneOf(event, event.currentTarget, id) };
  };

  handleDrop = (event, id) => {
    event.preventDefault();
    const zone = this.dropAt?.zone || 'after';
    const dragged = this.dragId;
    this.clearDrag();
    if(!dragged || dragged === id) return;
    this.host.dropOn(dragged, id, zone);
  };

  clearDrag = () => {
    this.dragId = null;
    this.dropAt = null;
  };

  toggle(id){
    const next = new Set(this.collapsed);
    if(next.has(id)) next.delete(id);
    else next.add(id);
    this.collapsed = next;
  }

  /*
    Render
  */

  renderRow(node){
    const definition = this.registry.get(node.type);
    const slots = slotsOf(definition);
    const hasChildren = slots.some(slot => node.slots?.[slot.name]?.length);
    const selected = this.selection.includes(node.id);
    const drop = this.dropAt?.id === node.id ? this.dropAt.zone : '';
    const hint = hintOf(node);
    return html`
      <li>
        <div class="row ${selected ? 'selected' : ''} ${drop}" draggable="true" data-id="${node.id}"
          @click="${event => this.host.select(node.id, { additive: event.ctrlKey || event.metaKey || event.shiftKey })}"
          @dragstart="${event => this.handleDragStart(event, node.id)}"
          @dragover="${event => this.handleDragOver(event, node.id)}"
          @drop="${event => this.handleDrop(event, node.id)}"
          @dragend="${this.clearDrag}">
          ${hasChildren
            ? html`<button class="twisty no-btn" aria-label="Show or hide what is inside" @click="${event => { event.stopPropagation(); this.toggle(node.id); }}"><k-icon name="chevron" direction="${this.collapsed.has(node.id) ? 'right' : 'down'}"></k-icon></button>`
            : html`<span class="twisty"></span>`}
          <k-icon name="${definition?.icon || 'help'}"></k-icon>
          <span>${titleOf(this.registry, node)}</span>
          ${hint ? html`<span class="hint">${hint}</span>` : ''}
        </div>
        ${hasChildren && !this.collapsed.has(node.id) ? html`
          ${slots.map(slot => (node.slots?.[slot.name]?.length ? html`
            ${slots.length > 1 ? html`<div class="slot">${slot.label || slot.name}</div>` : ''}
            <ul>${node.slots[slot.name].map(child => this.renderRow(child))}</ul>
          ` : ''))}
        ` : ''}
      </li>
    `;
  }

  render(){
    if(!this.nodes?.length) return html`<div class="empty">No widgets yet.</div>`;
    return html`<ul role="tree">${this.nodes.map(node => this.renderRow(node))}</ul>`;
  }
}

customElements.define('admin-sitebuilder-tree', SitebuilderTree);
