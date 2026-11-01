import WidgetEditor from './WidgetEditor.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import HtmlEditor from '/kempo-ui/components/HtmlEditor.js';
import sanitizeHtml from '/kempo-ui/utils/sanitizeHtml.js';
import '/kempo-ui/components/Icon.js';

/*
  The editor side of the Markup widget: kempo-ui's visual HTML editor with the code view left out, so a person edits
  text and never markup. The page side of Markup has no element of its own (a page just holds the text), so this is the
  only component the Markup widget has.

  The editor's toolbar is its own control set, `sitebuilder`, added here so no other use of k-html-editor changes.
*/

HtmlEditor.controlSets.sitebuilder = {
  topLeft: html`
    <k-control-group>
      <kc-bold></kc-bold>
      <kc-italic></kc-italic>
      <kc-underline></kc-underline>
      <kc-strikethrough></kc-strikethrough>
    </k-control-group>
    <kc-inline-code></kc-inline-code>
    <kc-menu>
      <k-icon slot="icon" name="format_paragraph"></k-icon>
      <span slot="label">Text Style</span>
      <kc-format-block tag="p">Paragraph</kc-format-block>
      <kc-format-block tag="h1">Heading 1</kc-format-block>
      <kc-format-block tag="h2">Heading 2</kc-format-block>
      <kc-format-block tag="h3">Heading 3</kc-format-block>
      <kc-format-block tag="h4">Heading 4</kc-format-block>
      <kc-format-block tag="blockquote">Blockquote</kc-format-block>
      <kc-code-block></kc-code-block>
    </kc-menu>
    <k-control-group>
      <kc-bullet-list></kc-bullet-list>
      <kc-number-list></kc-number-list>
    </k-control-group>
    <k-control-group>
      <kc-align-left></kc-align-left>
      <kc-align-center></kc-align-center>
      <kc-align-right></kc-align-right>
    </k-control-group>
    <kc-create-link></kc-create-link>
    <kc-insert-image></kc-insert-image>
    <kc-insert-table></kc-insert-table>
    <kc-clear-formatting></kc-clear-formatting>
    <k-control-group>
      <kc-undo></kc-undo>
      <kc-redo></kc-redo>
    </k-control-group>
  `,
  topRight: null,
  bottomLeft: null,
  bottomRight: null
};

/* What the server's sanitizer allows (server/utils/sitebuilder/sanitize.js), so a person never types what will be stripped. */
const ALLOWED_TAGS = new Set(['P', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'EM', 'STRONG', 'B', 'I', 'U', 'S', 'SUB', 'SUP', 'SPAN', 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD']);
const ALLOWED_ATTRS = new Set(['class', 'dir', 'lang', 'style']);
const ALLOWED_ATTRS_PER_TAG = {
  A: new Set(['href', 'title', 'target', 'rel', 'name']),
  IMG: new Set(['src', 'alt', 'title', 'width', 'height']),
  OL: new Set(['start', 'type']),
  LI: new Set(['value']),
  TD: new Set(['colspan', 'rowspan', 'align']),
  TH: new Set(['colspan', 'rowspan', 'scope', 'align'])
};

export const cleanMarkup = value => sanitizeHtml(value, { allowedTags: ALLOWED_TAGS, allowedAttrs: ALLOWED_ATTRS, allowedAttrsPerTag: ALLOWED_ATTRS_PER_TAG });

export default class MarkupEditor extends WidgetEditor {
  static properties = {
    ...WidgetEditor.properties,
    initial: { state: true }
  };

  constructor(){
    super();
    this.initial = '';
    this.current = '';
    this.touched = false;
  }

  static styles = css`
    :host { display: block; margin-bottom: var(--spacer, 1rem); }
    k-html-editor { display: block; height: auto; min-height: 5rem; }
  `;

  connectedCallback(){
    super.connectedCallback();
    this.initial = this.innerHTML;
    this.current = this.initial;
    this.textContent = '';
    for(const type of ['pointerdown', 'keydown']){
      this.addEventListener(type, () => { this.touched = true; }, { capture: true });
    }
  }

  handleChange = event => {
    event.stopPropagation();
    if(!this.touched) return;
    const value = cleanMarkup(event.detail?.value ?? '');
    if(value === this.current) return;
    this.current = value;
    this.emitChange({ html: value });
  };

  render(){
    return html`<k-html-editor controls="sitebuilder" layout="floating" .value="${this.initial}" @change="${this.handleChange}"></k-html-editor>`;
  }
}

customElements.define('k-markup-editor', MarkupEditor);
