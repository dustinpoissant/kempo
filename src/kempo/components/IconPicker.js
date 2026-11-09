import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';
import Dialog from '/kempo-ui/components/Dialog.js';

/*
  The icons a site can use, loaded once: the site's, kempo's, kempo-ui's and every enabled extension's (GET /kempo/api/icons).
  A failed load is not kept, so the next open tries again.
*/
let catalogue = null;

const loadCatalogue = async () => {
  if(!catalogue){
    const response = await fetch('/kempo/api/icons');
    if(!response.ok) throw new Error(`The icons could not be loaded (${response.status})`);
    catalogue = await response.json();
  }
  return catalogue;
};

const titleOf = name => {
  const words = name.replace(/[-_]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/*
  The browser inside the picker's dialog, drawn like kempo-ui's Icon Selector: a filter box, then the icons as a grid of
  tiles with no names. The icons are grouped by where they come from (the site's, kempo's, each extension's), and a group
  with no icon left after filtering is not shown. A click selects a tile (`pending`); the dialog's button confirms it.
*/
class IconBrowser extends ShadowComponent {
  static properties = {
    value: { type: String },
    icons: { state: true },
    sources: { state: true },
    query: { state: true },
    pending: { state: true },
    error: { state: true },
  };

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
      gap: var(--spacer_h);
    }
    .grid .icon-option {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacer_h);
      font-size: 1.25rem;
      color: var(--tc);
      transition: background var(--animation_ms);
    }
    .grid .icon-option:hover:not(.bg-primary) {
      background: var(--c_bg__alt);
    }
    .grid .icon-option.bg-primary {
      color: var(--tc_light);
    }
  `;

  constructor(){
    super();
    this.value = '';
    this.icons = null;
    this.sources = [];
    this.query = '';
    this.pending = '';
    this.error = '';
  }

  /*
    Lifecycle callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    loadCatalogue().then(data => {
      this.icons = data.icons;
      this.sources = data.sources;
    }).catch(error => {
      this.error = error.message;
    });
  }

  willUpdate(changed){
    if(changed.has('value')) this.pending = this.value;
  }

  /*
    Event handlers
  */

  search = event => {
    this.query = event.target.value;
  };

  pick = icon => {
    this.pending = icon.src;
  };

  /*
    Public getters
  */

  get chosen(){
    return { value: this.pending, label: this.icons?.find(icon => icon.src === this.pending)?.label ?? '' };
  }

  /*
    Utility functions
  */

  groups(){
    const needle = this.query.trim().toLowerCase();
    return this.sources.map(source => ({
      ...source,
      icons: (this.icons ?? []).filter(icon => icon.source === source.id && (!needle || icon.label.toLowerCase().includes(needle) || icon.name.toLowerCase().includes(needle)))
    })).filter(group => group.icons.length);
  }

  /*
    Rendering
  */

  render(){
    if(this.error) return html`<div class="p"><p class="tc-danger" role="alert">${this.error}</p></div>`;
    if(!this.icons) return html`<div class="p"><p class="tc-muted">Loading the icons</p></div>`;
    const groups = this.groups();
    return html`
      <div class="p">
        <input type="search" class="full mb" placeholder="Filter icons..." aria-label="Filter icons" autocomplete="off" .value=${this.query} @input=${this.search}>
        ${groups.length ? groups.map(group => html`
          <h6 class="mtq mbq">${group.label}</h6>
          <div class="grid">
            ${group.icons.map(icon => html`
              <button type="button" class="no-btn icon-option r${icon.src === this.pending ? ' bg-primary' : ''}" title="${icon.label}" aria-label="${icon.label}" aria-pressed=${icon.src === this.pending} @click=${() => this.pick(icon)}>
                <k-icon src=${icon.src}></k-icon>
              </button>`)}
          </div>`) : html`<p class="tc-muted">No icons match</p>`}
      </div>
    `;
  }
}

customElements.define('k-icon-browser', IconBrowser);

/*
  Choose one icon from every icon the site has, served at /kempo/components/IconPicker.js. The value is the icon's
  address (`/kempo-ui/icons/add.svg`), which is what an icon attribute stores and `<k-icon src>` reads. It is a form
  input, so it submits under its `name`, and it fires `change` with detail `{ value, label }`. With `allow-none` the
  dialog's Clear button sets the value to an empty string.

  The choices open in a kempo-ui dialog in the page's overlay layer, not inside this element, so they are never
  trapped under a panel's stacking context (the page builder's own panel, for one).

    <k-icon-picker name="icon" value="/kempo-ui/icons/add.svg" allow-none></k-icon-picker>
*/
export default class IconPicker extends ShadowComponent {
  static formAssociated = true;

  static properties = {
    value: { type: String, reflect: true },
    name: { type: String, reflect: true },
    placeholder: { type: String },
    allowNone: { type: Boolean, attribute: 'allow-none' },
    disabled: { type: Boolean, reflect: true },
  };

  static styles = css`
    .current {
      display: flex;
      align-items: center;
      gap: var(--spacer_q);
    }
  `;

  constructor(){
    super();
    this.internals = this.attachInternals();
    this.value = '';
    this.name = '';
    this.placeholder = 'Choose an icon';
    this.allowNone = false;
    this.disabled = false;
    this.dialog = null;
  }

  /*
    Lifecycle callbacks
  */

  connectedCallback(){
    super.connectedCallback();
    this.internals.setFormValue(this.value);
  }

  disconnectedCallback(){
    this.dialog?.close();
    super.disconnectedCallback();
  }

  willUpdate(changed){
    if(changed.has('value')) this.internals.setFormValue(this.value);
  }

  /*
    Event handlers
  */

  open = () => {
    if(this.dialog) return;
    const browser = document.createElement('k-icon-browser');
    browser.value = this.value;
    this.dialog = Dialog.create(browser, {
      title: 'Choose an Icon',
      width: '32rem',
      cancelText: this.allowNone ? 'Clear' : 'Cancel',
      confirmText: 'Choose Icon',
      cancelAction: () => {
        if(this.allowNone) this.choose({ value: '', label: '' });
      },
      confirmAction: () => this.choose(browser.chosen),
      closeCallback: () => {
        this.dialog = null;
      }
    });
  };

  choose = ({ value, label }) => {
    if(value === this.value) return;
    this.value = value;
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value, label } }));
  };

  /*
    Drawing
  */

  currentLabel(){
    if(!this.value) return this.allowNone ? 'No icon' : this.placeholder;
    return titleOf(this.value.split('/').pop().replace(/\.svg$/, ''));
  }

  render(){
    return html`
      <button type="button" class="full" ?disabled=${this.disabled} @click=${this.open}>
        <span class="current">${this.value ? html`<k-icon src=${this.value}></k-icon>` : nothing}${this.currentLabel()}</span>
      </button>
    `;
  }
}

customElements.define('k-icon-picker', IconPicker);
