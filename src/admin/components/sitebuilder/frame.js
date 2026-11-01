import { renderNodes } from '/kempo/sitebuilder/render.js';
import { cleanMarkup } from '/kempo/sitebuilder/components/MarkupEditor.js';

/*
  The page as the editor shows it: an iframe holding the site's own stylesheets, with the tree rendered into it in
  editor mode (every widget's element carries data-sb-id, containers are marked as drop targets). This class owns that
  iframe. The editor hands it the tree to show and the ids to mark as selected, and it reports what the person did
  through the handlers:

    onSelect(id, { additive })        a widget was clicked
    onBlank()                         the page itself was clicked
    onText(id, attribute, value)      a widget's own text was typed into
    onCell(id, row, column, value)    a table cell was typed into
    onChange(id, changes)             a widget editor changed its settings (a widget-change event)
    onDrop(id, place)                 a widget was dropped: { parentId, slot, index }
    canDrop(id, parentId, slot)       whether the dragged widget may go in that list
    restricted(id)                    whether the widget can only go in one kind of parent (a column)
    onKeyDown(event)                  a key was pressed inside the page
    locate(id)                        the editor tells where a widget is: { parentId, slot, index } or null

  The iframe is on the same origin, so the editor reads and writes its document directly.
*/

const FRAME_URL = '/admin/content/pages/sitebuilder-frame.html';

export default class Frame {
  constructor(iframe, registry, handlers){
    this.iframe = iframe;
    this.registry = registry;
    this.handlers = handlers;
    this.loaded = new Set();
    this.selection = [];
    this.dragging = null;
    this.pointerAt = -Infinity;
    this.windowFocusAt = -Infinity;
    this.renderedAt = -Infinity;
    this.ready = new Promise(resolve => {
      iframe.addEventListener('load', () => {
        this.attach();
        resolve();
      }, { once: true });
      iframe.src = FRAME_URL;
    });
  }

  get document(){
    return this.iframe.contentDocument;
  }

  get root(){
    return this.document?.getElementById('sb-root');
  }

  /*
    Events
  */

  attach(){
    const doc = this.document;
    doc.addEventListener('mousedown', this.handleMouseDown, true);
    doc.addEventListener('click', this.handleClick, true);
    doc.addEventListener('input', this.handleInput, true);
    doc.addEventListener('focusin', this.handleFocusIn, true);
    doc.addEventListener('keydown', this.handleKeyDown, true);
    doc.addEventListener('widget-change', this.handleWidgetChange);
    doc.addEventListener('pointerdown', this.startDrag);
    this.iframe.contentWindow.addEventListener('focus', () => { this.windowFocusAt = performance.now(); });
    this.iframe.contentWindow.addEventListener('resize', this.placeHandle);
    this.iframe.contentWindow.addEventListener('scroll', this.placeHandle);
    this.iframe.contentWindow.addEventListener('scroll', () => this.dragging && this.highlight());
  }

  widgetOf = target => target?.closest?.('[data-sb-id]') || null;

  handleMouseDown = event => {
    this.pointerAt = performance.now();
    if(event.target.closest?.('#sb-handle')){
      event.preventDefault();
      return;
    }
    const chain = this.chainOf(event.target);
    if(!chain.length){
      this.handlers.onBlank();
      return;
    }
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    const target = this.pick(chain, additive);
    const id = target.dataset.sbId;
    if(additive || !(this.selection.length === 1 && this.selection[0] === id)){
      event.preventDefault();
      event.stopPropagation();
      this.handlers.onSelect(id, { additive });
    }
  };

  /* The widgets around a point in the page, outermost first. */
  chainOf = target => {
    const chain = [];
    for(let element = this.widgetOf(target); element; element = this.widgetOf(element.parentElement)) chain.unshift(element);
    return chain;
  };

  /*
    Which widget a click selects. The first click selects the outermost widget under it; a click inside the selected
    widget selects the next one down towards what was clicked, so each click goes one level deeper. With Ctrl or Shift
    it is the widget beside the selected ones (the same parent).
  */
  pick(chain, additive){
    if(additive){
      const last = this.selection[this.selection.length - 1];
      const parentId = last ? this.handlers.locate(last)?.parentId ?? null : null;
      return chain.find(element => (this.handlers.locate(element.dataset.sbId)?.parentId ?? null) === parentId) || chain[chain.length - 1];
    }
    const selected = this.selection.length === 1 ? this.document.querySelector(`[data-sb-id="${CSS.escape(this.selection[0])}"]`) : null;
    /* A widget can be drawn as two elements with its id (a tab and its content), so the content counts as the selected one too. */
    const depth = selected ? chain.findLastIndex(element => element.dataset.sbId === this.selection[0] || element.contains(selected)) : -1;
    return chain[depth === -1 ? 0 : Math.min(depth + 1, chain.length - 1)];
  }

  /*
    A widget the keyboard reaches (Tab) becomes the selection, as a first click does. Focus that comes back to the page
    with the window (the widget that last had it gets it again), or to widgets the page has just drawn again (an editor
    that takes the focus as it starts, say) is not a choice: it is taken away again, so the caret and the editor's
    floating toolbar do not stay on a widget that is not selected.
  */
  handleFocusIn = event => {
    const element = this.widgetOf(event.target);
    if(!element || this.selection.includes(element.dataset.sbId)) return;
    setTimeout(() => {
      const since = at => performance.now() - at;
      if(this.selection.includes(element.dataset.sbId) || since(this.pointerAt) < 500) return;
      if(since(this.windowFocusAt) < 500 || since(this.renderedAt) < 2000){
        if(this.document.activeElement?.closest?.('[data-sb-id]') === element) this.blurFocus();
        return;
      }
      this.handlers.onSelect(element.dataset.sbId, { additive: false });
    });
  };

  /* A link or a button in the page must not take the editor somewhere else. */
  handleClick = event => {
    const link = event.target.closest?.('a[href], form');
    if(link && !event.target.closest('[contenteditable]')) event.preventDefault();
  };

  handleInput = event => {
    const edit = event.target.closest?.('[data-sb-edit]');
    if(edit){
      this.handlers.onText(edit.dataset.sbId, edit.dataset.sbEdit, edit.textContent.replace(/\s+/g, ' ').trim());
      return;
    }
    const cell = event.target.closest?.('[data-sb-cell]');
    if(cell){
      const [row, column] = cell.dataset.sbCell.split(',').map(Number);
      this.handlers.onCell(cell.closest('[data-sb-id]').dataset.sbId, row, column, cell.textContent);
    }
  };

  handleKeyDown = event => {
    if(this.dragging && event.key === 'Escape'){
      this.clearDrag();
      return;
    }
    if(event.key === 'Enter' && event.target.closest?.('[data-sb-edit], [data-sb-cell]')){
      event.preventDefault();
      return;
    }
    this.handlers.onKeyDown(event);
  };

  handleWidgetChange = event => {
    const { id, changes } = event.detail || {};
    if(id && changes) this.handlers.onChange(id, changes);
  };

  /*
    Showing the tree
  */

  /*
    The modules must be loaded by the iframe's own window, or the components would be defined in the admin's registry
    and the iframe's elements would never upgrade. A script tag inside the iframe does that.
  */
  async loadModulesInFrame(nodes){
    const doc = this.document;
    const needed = new Set();
    const visit = list => {
      for(const node of list){
        const definition = this.registry.get(node.type);
        const url = definition?.editor_component || definition?.page_component;
        if(url) needed.add(url);
        for(const children of Object.values(node.slots || {})) visit(children);
      }
    };
    visit(nodes);
    const fresh = [...needed].filter(url => !this.loaded.has(url));
    await Promise.all(fresh.map(url => new Promise(resolve => {
      this.loaded.add(url);
      const script = doc.createElement('script');
      script.type = 'module';
      script.src = url;
      script.addEventListener('load', resolve);
      script.addEventListener('error', resolve);
      doc.head.appendChild(script);
    })));
  }

  async render(nodes, selection){
    await this.ready;
    this.loadModulesInFrame(nodes);
    const scroll = this.iframe.contentWindow.scrollY;
    this.root.innerHTML = renderNodes(nodes, { registry: this.registry, editor: true, sanitize: cleanMarkup });
    this.renderedAt = performance.now();
    this.setSelection(selection);
    this.iframe.contentWindow.scrollTo(0, scroll);
  }

  /*
    Selection
  */

  setSelection(ids){
    this.selection = ids;
    const doc = this.document;
    if(!doc) return;
    const active = doc.activeElement;
    if(active && active !== doc.body && !ids.includes(active.closest('[data-sb-id]')?.dataset.sbId)) this.blurFocus();
    for(const element of doc.querySelectorAll('.sb-selected')) element.classList.remove('sb-selected', 'sb-restricted');
    for(const element of doc.querySelectorAll('[contenteditable]')) {
      if(element.matches('[data-sb-edit], [data-sb-cell]')) element.removeAttribute('contenteditable');
    }
    for(const id of ids){
      for(const element of doc.querySelectorAll(`[data-sb-id="${CSS.escape(id)}"]`)){
        element.classList.add('sb-selected');
        element.classList.toggle('sb-restricted', this.handlers.restricted(id));
        if(ids.length === 1){
          if(element.matches('[data-sb-edit]')) element.setAttribute('contenteditable', 'plaintext-only');
          for(const cell of element.querySelectorAll('[data-sb-cell]')) cell.setAttribute('contenteditable', 'plaintext-only');
        }
        if(element.matches('k-tab, k-accordion-header') && ids.length === 1) element.click?.();
        if(ids.length === 1) this.showTabsAround(element);
      }
    }
    this.placeHandle();
    requestAnimationFrame(() => this.placeHandle());
  }

  /* A widget inside a tab that is not showing is invisible, and has no place for the handle, so its tabs are opened. */
  showTabsAround(element){
    const panels = [];
    for(let panel = element.closest('k-tab-content'); panel; panel = panel.parentElement?.closest('k-tab-content')) panels.unshift(panel);
    for(const panel of panels){
      if(!panel.hasAttribute('active') && panel.parentElement) panel.parentElement.active = panel.getAttribute('name');
    }
  }

  /* Takes the keyboard focus out of the page, even from an editor inside a widget's shadow DOM. */
  blurFocus(){
    let active = this.document?.activeElement;
    while(active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if(active && active !== this.document.body) active.blur();
  }

  scrollTo(id){
    const element = this.document.querySelector(`[data-sb-id="${CSS.escape(id)}"]`);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /*
    Dragging: the handle sits on the first selected widget
  */

  placeHandle = () => {
    const doc = this.document;
    const handle = doc?.getElementById('sb-handle');
    if(!handle) return;
    const element = this.selection.length ? doc.querySelector(`[data-sb-id="${CSS.escape(this.selection[0])}"]`) : null;
    if(!element){
      handle.style.display = 'none';
      return;
    }
    if(element.offsetHeight === 0 || element.offsetWidth === 0){
      element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    }
    const rect = element.getBoundingClientRect();
    const scrollX = this.iframe.contentWindow.scrollX;
    const scrollY = this.iframe.contentWindow.scrollY;
    handle.style.display = 'flex';
    handle.classList.toggle('sb-restricted', this.handlers.restricted(this.selection[0]));
    handle.style.left = `${Math.max(0, rect.left + scrollX)}px`;
    handle.style.top = `${Math.max(0, rect.top + scrollY - 24)}px`;
  };

  /*
    The drag is made of pointer events, not the browser's own drag and drop, because the browser does not scroll a page
    with the wheel while something is dragged over it. The handle captures the pointer, so the drag goes on (and ends)
    even when the pointer leaves the page area.
  */
  startDrag = event => {
    const handle = event.target.closest?.('#sb-handle');
    if(!handle || event.button !== 0 || !this.selection.length) return;
    this.dragging = this.selection[0];
    this.pointer = event;
    handle.setPointerCapture(event.pointerId);
    handle.addEventListener('pointermove', this.moveDrag);
    handle.addEventListener('pointerup', this.endDrag);
    handle.addEventListener('pointercancel', this.clearDrag);
    this.document.body.classList.add('sb-dragging');
    this.showZones();
  };

  moveDrag = event => {
    this.pointer = event;
    this.autoScroll();
    this.highlight();
  };

  endDrag = event => {
    this.pointer = event;
    const zone = this.dropZone(event);
    const id = this.dragging;
    const place = zone && this.placeOf(zone);
    this.clearDrag();
    if(place && id) this.handlers.onDrop(id, place);
  };

  /*
    While a widget is dragged, every place it may go is an outlined box on the page: a zone between the widgets of each
    list (the page and every container), and each empty container. The box under the pointer fills in and the drop goes
    there; letting go anywhere else cancels it.
  */
  showZones(){
    if(!this.dragging) return;
    const doc = this.document;
    const dragged = CSS.escape(this.dragging);
    this.root.classList.toggle('sb-drag-restricted', this.handlers.restricted(this.dragging));
    const lists = [
      { element: this.root, parentId: null, slot: '' },
      ...[...doc.querySelectorAll('[data-sb-slot]')].map(element => ({ element, parentId: element.dataset.sbOwner || element.dataset.sbId, slot: element.dataset.sbSlot }))
    ].filter(list => !list.element.closest(`[data-sb-id="${dragged}"]`) && this.handlers.canDrop(this.dragging, list.parentId, list.slot));
    for(const list of lists){
      const items = [...list.element.children].filter(child => child.dataset.sbId && !child.hasAttribute('slot'));
      if(!items.length){
        if(list.element !== this.root) list.element.classList.add('sb-zone-empty');
        continue;
      }
      const from = items.findIndex(item => item.dataset.sbId === this.dragging);
      items.forEach((item, index) => {
        if(from === -1 || (index !== from && index !== from + 1)) item.before(this.zone(list, index));
      });
      if(from !== items.length - 1) items[items.length - 1].after(this.zone(list, items.length));
    }
  }

  /*
    A place that would not move the widget (just before or after where it already is) has no zone. A widget that can
    only go in one kind of parent (a column, a section) has orange zones, in those parents only; the others have green
    zones, including one at the very top of the page.
  */
  zone(list, index){
    const zone = this.document.createElement('div');
    zone.className = 'sb-zone';
    zone.place = { parentId: list.parentId, slot: list.slot, index };
    return zone;
  }

  /* The zone the pointer is over, or null: letting go anywhere else cancels the drop. */
  dropZone(event){
    if(!this.dragging) return null;
    const over = zone => {
      const rect = zone.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };
    const doc = this.document;
    return [...doc.querySelectorAll('.sb-zone')].find(over) || [...doc.querySelectorAll('.sb-zone-empty')].find(over) || null;
  }

  placeOf = zone => zone.place || { parentId: zone.dataset.sbOwner || zone.dataset.sbId, slot: zone.dataset.sbSlot, index: Infinity };

  /* The zone under the pointer fills in. It is found again when the page scrolls, since the pointer is then over another. */
  highlight(){
    for(const element of this.document.querySelectorAll('.sb-zone-active')) element.classList.remove('sb-zone-active');
    this.dropZone(this.pointer)?.classList.add('sb-zone-active');
  }

  /* The wheel scrolls the page while dragging, and so does holding the pointer near its top or bottom edge: faster the closer it is. */
  autoScroll(){
    const edge = 100;
    const y = this.pointer.clientY;
    const height = this.iframe.contentWindow.innerHeight;
    this.scrollSpeed = y < edge ? -Math.ceil(Math.min(2, 1 - y / edge) * 30) : y > height - edge ? Math.ceil(Math.min(2, 1 - (height - y) / edge) * 30) : 0;
    if(!this.scrollSpeed || this.scrolling) return;
    this.scrolling = true;
    const step = () => {
      if(!this.dragging || !this.scrollSpeed){
        this.scrolling = false;
        return;
      }
      this.iframe.contentWindow.scrollBy(0, this.scrollSpeed);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  clearDrag = () => {
    this.dragging = null;
    this.scrollSpeed = 0;
    const doc = this.document;
    const handle = doc?.getElementById('sb-handle');
    handle?.removeEventListener('pointermove', this.moveDrag);
    handle?.removeEventListener('pointerup', this.endDrag);
    handle?.removeEventListener('pointercancel', this.clearDrag);
    doc?.body.classList.remove('sb-dragging');
    this.root?.classList.remove('sb-drag-restricted');
    for(const zone of doc?.querySelectorAll('.sb-zone') || []) zone.remove();
    for(const element of doc?.querySelectorAll('.sb-zone-empty, .sb-zone-active') || []) element.classList.remove('sb-zone-empty', 'sb-zone-active');
  };
}
