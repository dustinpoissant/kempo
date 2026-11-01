import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  A small floating toolbar (bold, italic, underline, link) for text a widget's editor lets a person type in place. A
  widget author marks an editable element with `contenteditable` and `data-sb-rich`, and puts one <k-inline-toolbar> in
  the page (the page editor's frame already has one). When text inside such an element is selected, the toolbar
  appears over it. It formats with the browser's own editing commands, so the element fires its usual `input` event
  and the widget's editor picks the new HTML up as it does any typing.

  ```html
  <p contenteditable data-sb-rich>Select some of this text.</p>
  <k-inline-toolbar></k-inline-toolbar>
  ```
*/
export default class InlineToolbar extends ShadowComponent {
  static properties = {
    visible: { type: Boolean, reflect: true },
    top: { state: true },
    left: { state: true }
  };

  constructor(){
    super();
    this.visible = false;
    this.top = 0;
    this.left = 0;
  }

  static styles = css`
    :host { position: absolute; z-index: 20; display: none; }
    :host([visible]) { display: block; }
    .bar { display: flex; gap: 0.125rem; padding: 0.25rem; background: var(--c_bg__alt, #333); border: 1px solid var(--c_border, #8884); border-radius: var(--radius, 0.25rem); box-shadow: 0 2px 8px #0004; }
    button { padding: 0.25rem 0.5rem; }
  `;

  connectedCallback(){
    super.connectedCallback();
    this.ownerDocument.addEventListener('selectionchange', this.handleSelection);
  }

  disconnectedCallback(){
    super.disconnectedCallback();
    this.ownerDocument.removeEventListener('selectionchange', this.handleSelection);
  }

  /* The selection's element, when it is inside text the toolbar is for. */
  richHost(){
    const selection = this.ownerDocument.getSelection();
    if(!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const node = selection.anchorNode?.nodeType === 1 ? selection.anchorNode : selection.anchorNode?.parentElement;
    return node?.closest?.('[contenteditable][data-sb-rich]') || null;
  }

  handleSelection = () => {
    const host = this.richHost();
    if(!host){
      this.visible = false;
      return;
    }
    const rect = this.ownerDocument.getSelection().getRangeAt(0).getBoundingClientRect();
    const view = this.ownerDocument.defaultView;
    this.top = rect.top + view.scrollY - 44;
    this.left = Math.max(0, rect.left + view.scrollX);
    this.style.top = `${this.top}px`;
    this.style.left = `${this.left}px`;
    this.visible = true;
  };

  /* mousedown, not click: a click would move the selection away before the command ran. */
  run = (event, command, value) => {
    event.preventDefault();
    this.ownerDocument.execCommand(command, false, value);
  };

  link = event => {
    event.preventDefault();
    const address = this.ownerDocument.defaultView.prompt('Link address');
    if(address === null) return;
    if(!address.trim()) this.ownerDocument.execCommand('unlink');
    else if(/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(address.trim())) this.ownerDocument.execCommand('createLink', false, address.trim());
  };

  render(){
    return html`
      <div class="bar" role="toolbar" aria-label="Text formatting">
        <button title="Bold" aria-label="Bold" @mousedown="${event => this.run(event, 'bold')}"><k-icon name="format_bold"></k-icon></button>
        <button title="Italic" aria-label="Italic" @mousedown="${event => this.run(event, 'italic')}"><k-icon name="format_italic"></k-icon></button>
        <button title="Underline" aria-label="Underline" @mousedown="${event => this.run(event, 'underline')}"><k-icon name="format_underlined"></k-icon></button>
        <button title="Link" aria-label="Link" @mousedown="${this.link}"><k-icon name="link"></k-icon></button>
      </div>
    `;
  }
}

customElements.define('k-inline-toolbar', InlineToolbar);
