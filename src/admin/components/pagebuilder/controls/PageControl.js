import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  A button (or a link) kempo adds to the page builder's control bar: the page's own actions (its settings, head code, copy,
  move, replace and delete) and the links back to the pages and to the page. It is a kempo-ui ButtonControl, so it looks
  like the builder's own controls, and in the "more" menu it is a row with its `label`.

    icon, direction    the icon (a k-icon name) and the way it points
    label              the title of the button, and its text in the "more" menu
    href, target       a link: the address is opened (in a new tab with target="_blank")
    action             a function called when it is pressed (a button, with no href)
    danger             drawn in the danger colour
*/
export default class PageControl extends ButtonControl {
  static properties = {
    ...ButtonControl.properties,
    icon: { type: String },
    direction: { type: String },
    label: { type: String },
    href: { type: String },
    target: { type: String },
    danger: { type: Boolean, reflect: true },
    action: { attribute: false }
  };

  constructor() {
    super();
    this.icon = '';
    this.direction = '';
    this.label = '';
    this.href = '';
    this.target = '';
    this.danger = false;
    this.action = null;
  }

  /*
    Lifecycle Callbacks
  */
  willUpdate(changed) {
    if(changed.has('label') && this.label) this.title = this.label;
  }

  /*
    Event Handlers
  */
  handleAction() {
    if(!this.href) return this.action?.();
    if(this.target === '_blank') window.open(this.href, '_blank', 'noopener');
    else window.location.href = this.href;
  }

  /*
    Rendering
  */
  render() {
    return html`<slot><k-icon name="${this.icon}" direction="${this.direction}"></k-icon></slot><slot name="menu-text">${this.label}</slot>`;
  }

  static styles = [
    ...ButtonControl.styles,
    css`
      :host([danger]) {
        color: var(--tc_danger);
      }
    `
  ];
}

customElements.define('admin-pb-control', PageControl);
