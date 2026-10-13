import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html, nothing, repeat, keyed } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Dialog.js';
import '/kempo-ui/components/Sortable.js';
import { getDashboardWidgets } from '/kempo/sdk.js';
import { resolveLayout, serializeLayout, reorder, readStored, writeStored, clearStored } from './dashboardLayout.js';

// Wide enough for the columns; narrower screens shrink it rather than scroll.
const ROW_WIDTH = 'min(32rem, 70vw)';

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/*
  The admin dashboard: a grid four blocks wide of widgets one to four blocks wide and one to three tall.

  The server only says which widgets exist and their size bounds. Which of them are shown, in what order
  and at what size is the user's own and lives in this browser's localStorage, changed through the
  Customize dialog and applied only when it is saved. A widget's script is not imported, and so nothing
  it needs is fetched, until it is both on the user's dashboard and rendered; a widget the user hides is
  torn down and starts fresh when it is shown again.

  Attributes: `heading`, the title shown above the grid.
*/
export default class Dashboard extends LightComponent {
  static properties = {
    heading: { type: String },
    layout: { state: true },
    draft: { state: true },
    sortVersion: { state: true },
    columns: { state: true },
    loading: { state: true },
    failure: { state: true },
    failures: { state: true }
  };

  #definitions = [];
  #unavailable = [];
  #resetting = false;
  #elements = new Map();
  #pending = new Set();
  #observer = null;

  constructor(){
    super();
    this.heading = '';
    this.layout = [];
    this.draft = [];
    this.sortVersion = 0;
    this.columns = 4;
    this.loading = true;
    this.failure = '';
    this.failures = {};
  }

  /*
    Lifecycle Callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    this.classList.add('d-b');
    this.#observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      const columns = width >= 880 ? 4 : width >= 560 ? 2 : 1;
      if(columns !== this.columns) this.columns = columns;
    });
    this.#observer.observe(this);
    this.load();
  }

  disconnectedCallback(){
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  updated(changed){
    super.updated(changed);
    this.layout.forEach(({ widget, visible, width, height }) => {
      const element = this.#elements.get(widget.id);
      if(!visible || !element) return;
      element.width = Math.min(width, this.columns);
      element.height = height;
    });
  }

  /*
    Public Methods
  */

  load = async () => {
    const [error, data] = await getDashboardWidgets();
    this.loading = false;

    if(error){
      this.failure = `Could not load the dashboard: ${error.msg}`;
      return;
    }

    this.failure = '';
    this.#definitions = data.widgets;
    this.#unavailable = data.unavailable ?? [];
    this.layout = resolveLayout(this.#definitions, readStored());
    this.mountVisible();
  };

  /*
    Utility Functions
  */

  /*
    Imports a widget's module and creates its element, once. The element fetches its own data when it
    connects to the page, so nothing is requested for a widget that is hidden.
  */
  mount = async ({ widget }) => {
    if(this.#elements.has(widget.id) || this.#pending.has(widget.id)) return;
    this.#pending.add(widget.id);

    try {
      await import(widget.module);
      if(!customElements.get(widget.element)){
        throw new Error(`${widget.module} did not define <${widget.element}>`);
      }
      const element = document.createElement(widget.element);
      element.definition = widget;
      this.#elements.set(widget.id, element);
    } catch(error) {
      this.failures = { ...this.failures, [widget.id]: `is not available: its script ${widget.module} could not be loaded, which usually means the extension that provides it needs updating.` };
      console.error(`Dashboard widget ${widget.id} failed to load:`, error);
    }

    this.#pending.delete(widget.id);
    this.requestUpdate();
  };

  mountVisible = () => this.layout.filter(({ visible }) => visible).forEach(this.mount);

  /*
    Applies a layout, remembers it, and mounts anything newly shown. Widgets no longer shown are released
    here so showing them again loads fresh data. A layout identical to the defaults is not stored, so the
    user keeps following the defaults as they change.
  */
  commit = layout => {
    const stored = serializeLayout(layout, { stored: this.#resetting ? null : readStored(), unavailable: this.#unavailable });
    this.layout = layout;

    if(JSON.stringify(stored) === JSON.stringify(serializeLayout(resolveLayout(this.#definitions, null)))){
      clearStored();
    } else {
      writeStored(stored);
    }

    layout.filter(({ visible }) => !visible).forEach(({ widget }) => {
      this.#elements.delete(widget.id);
      if(this.failures[widget.id]){
        const { [widget.id]: dropped, ...rest } = this.failures;
        this.failures = rest;
      }
    });

    this.mountVisible();
  };

  /*
    Event Handlers
  */

  openCustomize = () => {
    this.#resetting = false;
    this.draft = this.layout.map(entry => ({ ...entry }));
    this.sortVersion++;
    this.querySelector('k-dialog').open();
  };

  save = () => this.commit(this.draft);

  resetDraft = () => {
    this.#resetting = true;
    this.draft = resolveLayout(this.#definitions, null);
    this.sortVersion++;
  };

  changeDraft = (id, changes) => {
    this.draft = this.draft.map(entry => entry.widget.id === id ? { ...entry, ...changes } : entry);
  };

  /*
    The sortable moves its own items in the DOM. The new order is read from there and the list is then
    rebuilt from the draft (the `keyed` version changes) so Lit never disagrees with the DOM.
  */
  handleSort = event => {
    this.draft = reorder(this.draft, [...event.currentTarget.children].map(item => item.dataset.widgetId));
    this.sortVersion++;
  };

  /*
    Rendering
  */

  /*
    The item sizes its content to fit, so the row sets its own width. Its drag handle is 3.5rem tall, so
    the row is the same height with its controls centered, and the columns have fixed widths that the
    header row above the list repeats. `.d-f` is avoided because it wraps.
  */
  renderDraftRow = ({ widget, visible, width, height }) => html`
    <k-sortable-item class="mbh" data-widget-id=${widget.id}>
      <div style="display: flex; flex-wrap: nowrap; align-items: center; gap: var(--spacer); width: ${ROW_WIDTH}; min-height: 3.5rem;">
        <div class="flex" style="display: flex; flex-wrap: nowrap; align-items: center; gap: var(--spacer_h); min-width: 0;">
          ${widget.icon ? html`<k-icon class=${visible ? '' : 'tc-muted'} name=${widget.icon}></k-icon>` : nothing}
          <strong class=${visible ? '' : 'tc-muted'}>${widget.title}</strong>
        </div>
        <select style="width: 4.5rem;" aria-label="${widget.title} width" ?disabled=${!visible} @change=${event => this.changeDraft(widget.id, { width: Number(event.target.value) })}>
          ${range(widget.minWidth, widget.maxWidth).map(value => html`<option value=${value} ?selected=${value === width}>${value}</option>`)}
        </select>
        <select style="width: 4.5rem;" aria-label="${widget.title} height" ?disabled=${!visible} @change=${event => this.changeDraft(widget.id, { height: Number(event.target.value) })}>
          ${range(widget.minHeight, widget.maxHeight).map(value => html`<option value=${value} ?selected=${value === height}>${value}</option>`)}
        </select>
        <button
          class="no-btn pq"
          style="width: 2.5rem;"
          title=${visible ? 'Hide' : 'Show'}
          aria-label="${visible ? 'Hide' : 'Show'} ${widget.title}"
          @click=${() => this.changeDraft(widget.id, { visible: !visible })}
        ><k-icon name=${visible ? 'hide' : 'show'}></k-icon></button>
      </div>
    </k-sortable-item>
  `;

  /*
    Column titles for the rows. The left offset is the sortable item's border and drag handle, so the
    columns line up with the rows below.
  */
  renderDraftHeader = () => html`
    <div class="small tc-muted mbh" style="display: flex; flex-wrap: nowrap; gap: var(--spacer); width: calc(${ROW_WIDTH} + 3.7rem); padding-left: 3.7rem;">
      <span class="flex">Widget</span>
      <span style="width: 4.5rem;">Width</span>
      <span style="width: 4.5rem;">Height</span>
      <span style="width: 2.5rem;"></span>
    </div>
  `;

  renderCustomizeDialog = () => html`
    <k-dialog
      confirm-text="Save"
      confirm-classes="primary ml"
      cancel-text="Cancel"
      .confirmAction=${this.save}
    >
      <h5 slot="title" class="pyh px m0">Customize dashboard</h5>
      <div class="p">
        <p class="small tc-muted">Drag to reorder. Hidden widgets are not loaded. Sizes are in blocks; the dashboard is four blocks wide.</p>
        ${this.renderDraftHeader()}
        ${keyed(this.sortVersion, html`
          <k-sortable @sort=${this.handleSort}>${this.draft.map(this.renderDraftRow)}</k-sortable>
        `)}
        <button class="mt" @click=${this.resetDraft}><k-icon name="restart_alt"></k-icon> Reset to defaults</button>
      </div>
    </k-dialog>
  `;

  /*
    The grid assigns the spans and row height, so they are set here as values rather than classes: they
    depend on each user's saved sizes and the width the grid currently has. A widget wider than the
    columns available is drawn as wide as the grid is; its saved width is kept for when there is room.
  */
  renderCell = ({ widget, width, height }) => {
    const element = this.#elements.get(widget.id);
    const failure = this.failures[widget.id];
    return html`
      <div
        data-widget-id=${widget.id}
        style="grid-column: span ${Math.min(width, this.columns)}; grid-row: span ${height}; min-width: 0;"
      >
        <section class="b r" style="height: 100%; min-height: 0; overflow: hidden;">
          ${failure
            ? html`<p class="p tc-danger" role="alert"><strong>${widget.title}</strong> ${failure}</p>`
            : element ?? html`<p class="p tc-muted"><strong>${widget.title}</strong> Loading&hellip;</p>`}
        </section>
      </div>
    `;
  };

  renderLightDom(){
    if(this.failure) return html`<p class="tc-danger" role="alert">${this.failure}</p>`;
    if(this.loading) return html`<p class="tc-muted">Loading&hellip;</p>`;

    const visible = this.layout.filter(entry => entry.visible);

    return html`
      <div class="d-f mb" style="align-items: center;">
        <h1 class="flex m0">${this.heading}</h1>
        <button @click=${this.openCustomize}><k-icon name="edit"></k-icon> Customize</button>
      </div>
      ${visible.length ? nothing : html`<p class="tc-muted">No widgets are shown. Choose Customize to add some.</p>`}
      <div class="d-g" style="grid-template-columns: repeat(${this.columns}, minmax(0, 1fr)); grid-auto-rows: 14rem; grid-auto-flow: dense; gap: var(--spacer);">
        ${repeat(visible, entry => entry.widget.id, this.renderCell)}
      </div>
      ${this.renderCustomizeDialog()}
    `;
  }
}

customElements.define('k-dashboard', Dashboard);
