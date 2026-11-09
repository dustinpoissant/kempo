import WidgetSettings from '/kempo-ui/components/pagebuilder/WidgetSettings.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { listFragments } from '/kempo/sdk.js';

/*
  The settings of kempo's server widgets, which only a kempo (CMS) site has: the fragment is chosen from the site's
  fragments, and the values a Conditional or Repeat reads are suggested from what the page has.
*/

let variables = [];

/* The names of the values the page being edited has (its <page> attributes and the built-ins), for the suggestions. */
export const setVariables = names => {
  variables = names || [];
};

let fragments = null;

const loadFragments = () => {
  fragments ??= listFragments().then(([error, data]) => (error ? null : (data.fragments || []).filter(fragment => !fragment.disabled)));
  return fragments;
};

/*
  A text setting with the page's values as suggestions. `hint` sits between the label and the field, as the rest of the
  admin does it.
*/
const renderValue = (settings, name, label, hint, { suggest = false } = {}) => {
  const id = `server-${name}`;
  return html`
    <div class="mb">
      <label class="d-b mbq" for="${id}">${label}<small class="d-b tc-muted">${hint}</small></label>
      <input id="${id}" type="text" class="full" list="${suggest ? 'server-values' : ''}" .value="${String(settings.node.attrs?.[name] ?? '')}" @input="${event => settings.set(name, event.target.value)}">
    </div>
  `;
};

const renderSuggestions = () => html`<datalist id="server-values">${variables.map(name => html`<option value="${name}"></option>`)}</datalist>`;

export class FragmentSettings extends WidgetSettings {
  static properties = {
    ...WidgetSettings.properties,
    list: { state: true }
  };

  constructor() {
    super();
    this.list = undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    loadFragments().then(list => {
      this.list = list;
    });
  }

  render() {
    if(this.list === undefined) return html`<p class="tc-muted">Loading the fragments</p>`;
    if(this.list === null) return renderValue(this, 'name', 'Fragment name', 'The name of a fragment, such as nav or footer.');
    const name = this.node.attrs?.name || '';
    const current = this.list.find(fragment => fragment.name === name);
    return html`
      <div class="mb">
        <label class="d-b mbq" for="server-fragment">Fragment<small class="d-b tc-muted">The shared content placed here, edited in one place. Fragments are made under Content, Fragments in the admin.</small></label>
        <select id="server-fragment" class="full" @change="${event => this.set('name', event.target.value, false)}">
          <option value="" ?selected="${!name}">Choose a fragment</option>
          ${this.list.map(fragment => html`<option value="${fragment.name}" ?selected="${fragment.name === name}">${fragment.name}</option>`)}
          ${name && !current ? html`<option value="${name}" selected>${name} (not found)</option>` : ''}
        </select>
        ${current ? html`<a class="btn mtq" href="/admin/content/fragments/edit?fragment=${encodeURIComponent(current.file.replace(/\.fragment\.html$/, ''))}" target="_blank" rel="noopener">Edit this fragment</a>` : ''}
      </div>
    `;
  }
}

export class ConditionalSettings extends WidgetSettings {
  render() {
    return html`
      ${renderValue(this, 'condition', 'Condition', 'The name of a value. Put ! in front to show the content when it is not set.', { suggest: true })}
      ${renderSuggestions()}
    `;
  }
}

export class RepeatSettings extends WidgetSettings {
  render() {
    return html`
      ${renderValue(this, 'in', 'List', 'The name of a value that holds a list.', { suggest: true })}
      ${renderValue(this, 'as', 'Item name', 'What each item is called inside, as {{name}}.')}
      ${renderSuggestions()}
    `;
  }
}

customElements.define('admin-pagebuilder-fragment-settings', FragmentSettings);
customElements.define('admin-pagebuilder-conditional-settings', ConditionalSettings);
customElements.define('admin-pagebuilder-repeat-settings', RepeatSettings);
