import DashboardWidget from '/kempo/components/DashboardWidget.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { listExtensions } from '/kempo/sdk.js';

/*
  How many extensions are installed and how many of those are switched off.
*/
export default class ExtensionsWidget extends DashboardWidget {
  static properties = {
    ...DashboardWidget.properties,
    total: { state: true },
    disabled: { state: true }
  };

  constructor(){
    super();
    this.total = 0;
    this.disabled = 0;
    this.cta = { label: 'Add extension', icon: 'extension_add', permission: 'system:extensions:install', href: '/admin/extensions' };
  }

  /*
    Public Methods
  */

  load = async () => {
    const { items, total } = await this.unwrap(listExtensions({ limit: 100 }));
    this.total = total;
    this.disabled = items.filter(item => !item.enabled).length;
  };

  /*
    Rendering
  */

  renderContent(){
    if(!this.total) return html`<p class="tc-muted">No extensions installed.</p>`;
    return html`
      <div class="h1 m0">${this.total}</div>
      <div class="tc-muted">${this.total === 1 ? 'Extension' : 'Extensions'}${this.disabled ? html`, ${this.disabled} disabled` : ''}</div>
    `;
  }
}

customElements.define('k-widget-extensions', ExtensionsWidget);
