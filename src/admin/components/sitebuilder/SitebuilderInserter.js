import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import widgetIcon from './widgetIcon.js';

const CATEGORY_TITLES = {
  text: 'Text',
  media: 'Media',
  layout: 'Layout',
  content: 'Content',
  interactive: 'Interactive',
  server: 'Server'
};
const CATEGORY_ORDER = Object.keys(CATEGORY_TITLES);

/*
  The list of widgets a person can add, searchable and grouped by category. It lists only the widgets that can go where the
  new one will be put, and calls host.insert(type) when one is chosen.
*/
export default class SitebuilderInserter extends ShadowComponent {
  static properties = {
    registry: { attribute: false },
    host: { attribute: false },
    query: { state: true }
  };

  constructor(){
    super();
    this.query = '';
  }

  static styles = css`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.5rem; }
    .grid button { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem 0.5rem; text-align: center; height: 100%; }
    .grid small { opacity: 0.65; }
  `;

  focusSearch(){
    this.renderRoot.querySelector('input')?.focus();
  }

  matches(definition){
    const query = this.query.trim().toLowerCase();
    if(!query) return true;
    return [definition.title, definition.description, ...(definition.keywords || [])].some(text => String(text || '').toLowerCase().includes(query));
  }

  groups(){
    const available = this.registry.list().filter(definition => definition.category !== 'hidden' && this.host.canAdd(definition.key) && this.matches(definition));
    const byCategory = new Map();
    for(const definition of available){
      if(!byCategory.has(definition.category)) byCategory.set(definition.category, []);
      byCategory.get(definition.category).push(definition);
    }
    const titles = new Map(available.filter(definition => definition.category_title).map(definition => [definition.category, definition.category_title]));
    const names = [...byCategory.keys()].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return names.map(name => ({ name, title: CATEGORY_TITLES[name] || titles.get(name) || name[0].toUpperCase() + name.slice(1).replace(/[-_]+/g, ' '), widgets: byCategory.get(name) }));
  }

  render(){
    const groups = this.groups();
    return html`
      <div class="p">
        <input type="search" class="full mb" placeholder="Search widgets" aria-label="Search widgets" .value="${this.query}" @input="${event => { this.query = event.target.value; }}" @keydown="${event => { if(event.key === 'Enter' && groups.length) this.host.insert(groups[0].widgets[0].key); }}">
        ${groups.length ? groups.map(group => html`
          <h6 class="mb">${group.title}</h6>
          <div class="grid mb">
            ${group.widgets.map(definition => html`
              <button @click="${() => this.host.insert(definition.key)}" title="${definition.description || ''}">
                ${widgetIcon(definition, 'extension')}
                <span>${definition.title}</span>
              </button>
            `)}
          </div>
        `) : html`<p class="tc-muted">No widget matches that.</p>`}
      </div>
    `;
  }
}

customElements.define('admin-sitebuilder-inserter', SitebuilderInserter);
