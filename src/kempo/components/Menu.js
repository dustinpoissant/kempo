import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { getMenuBySlug } from '../sdk.js';

export default class Menu extends LightComponent {
  /*
    Reactive Properties
  */
  static get properties() {
    return {
      slug: { type: String, reflect: true },
      loaded: { type: Boolean, state: true },
      menuData: { state: true }
    };
  }

  constructor() {
    super();
    this.loaded = false;
    this.menuData = null;
  }

  /*
    Lifecycle
  */
  async connectedCallback() {
    super.connectedCallback();
    await this.fetchMenu();
  }

  /*
    Data Fetching
  */
  fetchMenu = async () => {
    if(!this.slug){
      this.loaded = true;
      return;
    }

    const [error, data] = await getMenuBySlug(this.slug);

    if(error){
      console.error(`<k-menu slug="${this.slug}">:`, error.msg);
      this.loaded = true;
      return;
    }

    this.menuData = data;
    this.loaded = true;
  };

  /*
    Render
  */
  updated(changedProperties) {
    super.updated(changedProperties);
  }

  renderItem(item) {
    const href = item.url || '#';
    const isActive = href !== '#' && window.location.pathname === href;
    const target = item.target === '_blank' ? '_blank' : '_self';

    return html`
      <li>
        <a
          href="${href}"
          ?class="${isActive}"
          target="${target}"
          rel="${target === '_blank' ? 'noopener noreferrer' : ''}"
          class="${isActive ? 'active' : ''}"
        >${item.label}</a>
        ${item.children?.length ? html`<ul>${item.children.map(child => this.renderItem(child))}</ul>` : ''}
      </li>
    `;
  }

  renderLightDom() {
    if(!this.loaded || !this.menuData) return html``;

    return html`
      <nav class="k-menu" data-slug="${this.slug}">
        <ul>${this.menuData.items.map(item => this.renderItem(item))}</ul>
      </nav>
    `;
  }
}

customElements.define('k-menu', Menu);
