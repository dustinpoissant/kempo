import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { attributeTypes, attributeDefault } from '/kempo/sitebuilder/attributes.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Toggle.js';

/*
  The fields of a widget's declared attributes, drawn by the attribute's type, calling host.setAttribute(id, name, value)
  as the person types. This is the settings panel's default content for a widget. A widget with its own settings
  component (`settings_component` and `settings_tag`) can place this element inside it to keep the declared fields and
  add its own controls around them. Hints sit between a field's label and the field, as the rest of the admin does.
*/
export default class SitebuilderFields extends ShadowComponent {
  static properties = {
    node: { attribute: false },
    registry: { attribute: false },
    host: { attribute: false },
    version: { type: Number },
    exclude: { attribute: false }
  };

  constructor(){
    super();
    this.exclude = [];
  }

  set(name, value, coalesce = true){
    this.host.setAttribute(this.node.id, name, value, coalesce);
  }

  /* Fills a field from the media library, opened on the kind of file the field wants (`picker`, `image` for an image field). */
  async pickAsset(attribute){
    const kind = attribute.picker || 'image';
    const choice = await window.kempo.openAssetPicker({ alt: this.node.attrs?.alt || '', kind });
    if(!choice) return;
    this.set(attribute.name, choice.url, false);
    if(kind === 'image' && attribute.name === 'src' && !this.node.attrs?.alt && choice.alt) this.set('alt', choice.alt, false);
  }

  renderField(attribute){
    const id = `sb-field-${attribute.name}`;
    const value = this.node.attrs?.[attribute.name] ?? attributeDefault(attribute);
    const field = (attributeTypes[attribute.type] || attributeTypes.string).field;
    const label = html`<label class="d-b mbq" for="${id}">${attribute.label || attribute.name}${attribute.hint ? html`<small class="d-b tc-muted">${attribute.hint}</small>` : ''}</label>`;
    if(field === 'toggle'){
      return html`<div class="d-f mb" style="align-items: center; gap: var(--spacer);"><k-toggle id="${id}" .value="${!!value}" @change="${event => this.set(attribute.name, event.detail.value, false)}"></k-toggle><label for="${id}">${attribute.label || attribute.name}</label></div>`;
    }
    if(field === 'select'){
      return html`<div class="mb">${label}<select id="${id}" class="full" @change="${event => this.set(attribute.name, event.target.value, false)}">${(attribute.options || []).map(option => html`<option value="${option.value}" ?selected="${String(option.value) === String(value)}">${option.label}</option>`)}</select></div>`;
    }
    if(field === 'textarea'){
      return html`<div class="mb">${label}<textarea id="${id}" class="full" rows="4" .value="${String(value ?? '')}" @input="${event => this.set(attribute.name, event.target.value)}"></textarea></div>`;
    }
    if(field === 'number'){
      return html`<div class="mb">${label}<input id="${id}" type="number" class="full" min="${attribute.min ?? ''}" max="${attribute.max ?? ''}" .value="${String(value ?? '')}" @input="${event => this.set(attribute.name, event.target.value)}"></div>`;
    }
    if(field === 'image'){
      return html`
        <div class="mb">${label}
          <input id="${id}" type="text" class="full" .value="${String(value ?? '')}" @input="${event => this.set(attribute.name, event.target.value)}">
          ${window.kempo?.openAssetPicker ? html`<button class="mtq" @click="${() => this.pickAsset(attribute)}"><k-icon name="image"></k-icon> Choose from the media library</button>` : ''}
        </div>`;
    }
    const list = attribute.variables ? 'sb-variables' : (attribute.name === 'name' && this.node.type === 'fragment' ? 'sb-fragments' : '');
    return html`
      <div class="mb">${label}
        <input id="${id}" type="text" class="full" list="${list}" .value="${String(value ?? '')}" @input="${event => this.set(attribute.name, event.target.value)}">
        ${attribute.picker && window.kempo?.openAssetPicker ? html`<button class="mtq" @click="${() => this.pickAsset(attribute)}"><k-icon name="${attribute.picker === 'video' ? 'video' : attribute.picker === 'audio' ? 'audio' : 'file'}"></k-icon> Choose from the media library</button>` : ''}
      </div>`;
  }

  renderTable(){
    const rows = this.node.attrs?.rows?.length ? this.node.attrs.rows : [['', ''], ['', '']];
    const edit = change => this.set('rows', change(rows.map(row => [...row])), false);
    return html`
      <div class="mb">
        <label class="d-b mbq">Rows and columns<small class="d-b tc-muted">Click a cell on the page to type in it.</small></label>
        <p class="tc-muted mb0">${rows.length} rows, ${rows[0].length} columns</p>
        <div class="btn-grp mt">
          <button @click="${() => edit(data => [...data, Array(data[0].length).fill('')])}">Add row</button>
          <button ?disabled="${rows.length < 2}" @click="${() => edit(data => data.slice(0, -1))}">Remove row</button>
        </div>
        <div class="btn-grp mt">
          <button @click="${() => edit(data => data.map(row => [...row, '']))}">Add column</button>
          <button ?disabled="${rows[0].length < 2}" @click="${() => edit(data => data.map(row => row.slice(0, -1)))}">Remove column</button>
        </div>
      </div>
    `;
  }

  render(){
    if(!this.node) return '';
    const definition = this.registry.get(this.node.type);
    const valueOf = name => this.node.attrs?.[name] ?? attributeDefault(definition.attributes.find(attribute => attribute.name === name) || {});
    const attributes = (definition?.attributes || []).filter(attribute => !attribute.virtual && !this.exclude.includes(attribute.name) && Object.entries(attribute.when || {}).every(([name, value]) => String(valueOf(name)) === value));
    return html`
      ${attributes.map(attribute => this.renderField(attribute))}
      ${definition?.attributes?.some(attribute => attribute.type === 'table') ? this.renderTable() : ''}
      <datalist id="sb-variables">${(this.host.variables || []).map(name => html`<option value="${name}"></option>`)}</datalist>
      <datalist id="sb-fragments">${(this.host.fragments || []).map(name => html`<option value="${name}"></option>`)}</datalist>
    `;
  }
}

customElements.define('admin-sitebuilder-fields', SitebuilderFields);
