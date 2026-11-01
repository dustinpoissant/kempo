import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { titleOf } from './labels.js';
import './SitebuilderFields.js';
import '/kempo-ui/components/Icon.js';

/*
  The right panel. With a widget selected it shows the widget's name and description and then its settings: the fields
  of its declared attributes, or, when the widget declares a settings component (`settings_component` and
  `settings_tag`), that component instead. With nothing selected it is the page's own settings, which the page editor
  keeps and saves with the page.
*/
export default class SitebuilderAttributes extends ShadowComponent {
  static properties = {
    node: { attribute: false },
    count: { type: Number },
    registry: { attribute: false },
    host: { attribute: false },
    meta: { attribute: false },
    version: { type: Number }
  };

  constructor(){
    super();
    this.node = null;
    this.count = 0;
  }

  /*
    A widget's own settings component is loaded on first use and placed in the panel, given the selected widget, the
    registry, the editor and a version that changes with every change to the page (so it redraws).
  */
  async updated(){
    const container = this.renderRoot.querySelector('.custom');
    const definition = this.node && this.registry?.get(this.node.type);
    if(!container || !definition?.settings_tag) return;
    if(!customElements.get(definition.settings_tag)) await import(definition.settings_component);
    if(container.firstElementChild?.localName !== definition.settings_tag) container.replaceChildren(document.createElement(definition.settings_tag));
    Object.assign(container.firstElementChild, { node: this.node, registry: this.registry, host: this.host, version: this.version });
  }

  /* With nothing selected the panel is the page's own settings. */
  renderPage(){
    const editor = this.host.host;
    const { meta, page } = { meta: editor?.meta, page: editor?.page };
    if(!meta || !page) return html`<div class="p tc-muted">Select a widget to edit its settings.</div>`;
    const isSystem = page.owner === 'system';
    const text = (key, label, disabled = false) => html`
      <div class="mb">
        <label class="d-b mbq" for="sb-page-${key}">${label}</label>
        <input id="sb-page-${key}" type="text" class="full" .value="${meta[key]}" ?disabled="${disabled}" @input="${event => editor.setMeta({ [key]: event.target.value })}">
      </div>`;
    const info = (label, value) => html`<p class="mbq"><strong class="d-b">${label}</strong><span class="tc-muted">${value}</span></p>`;
    return html`
      <div class="p">
        <h5 class="mb"><k-icon name="settings"></k-icon> Page settings</h5>
        <p class="tc-muted">Select a widget on the page to edit its settings.</p>
        ${text('name', 'Name', isSystem)}
        ${text('title', 'Title')}
        ${text('description', 'Description', isSystem)}
        <div class="mb">
          <label class="d-b mbq" for="sb-page-template">Template</label>
          <select id="sb-page-template" class="full" @change="${event => editor.setMeta({ template: event.target.value })}">
            ${editor.templateChoices().map(choice => html`<option value="${choice.name}" ?selected="${choice.name === meta.template}">${choice.label}</option>`)}
          </select>
        </div>
        ${isSystem ? '' : info('Author', page.author || '')}
        ${info('Owner', page.owner || '')}
        ${info('Created', page.createdAt ? new Date(page.createdAt).toLocaleString() : '')}
        ${info('Updated', page.updatedAt ? new Date(page.updatedAt).toLocaleString() : '')}
        ${Object.entries(page.extraMetadata || {}).map(([key, value]) => info(key, value))}
      </div>
    `;
  }

  render(){
    if(this.count > 1) return html`<div class="p tc-muted">${this.count} widgets are selected. Select one to edit its settings.</div>`;
    if(!this.node) return this.renderPage();
    const definition = this.registry.get(this.node.type);
    return html`
      <div class="p">
        <h5 class="mb"><k-icon name="${definition?.icon || 'help'}"></k-icon> ${titleOf(this.registry, this.node)}</h5>
        ${definition?.description ? html`<p class="tc-muted">${definition.description}</p>` : ''}
        ${this.node.type === 'unknown' ? html`<p class="tc-muted">This content comes from something that is not installed. It is kept exactly as it was, and can be moved or deleted.</p>` : ''}
        ${this.node.type === 'markup' ? html`<p class="tc-muted">Click the text on the page to edit it.</p>` : ''}
        ${definition?.settings_tag
          ? html`<div class="custom"></div>`
          : html`<admin-sitebuilder-fields .node="${this.node}" .registry="${this.registry}" .host="${this.host}" .version="${this.version}"></admin-sitebuilder-fields>`}
      </div>
    `;
  }
}

customElements.define('admin-sitebuilder-attributes', SitebuilderAttributes);
