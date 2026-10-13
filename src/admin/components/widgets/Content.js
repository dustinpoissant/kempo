import DashboardWidget from '/kempo/components/DashboardWidget.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { listTemplates, listFragments, listGlobalContent } from '/kempo/sdk.js';

/*
  How many templates, fragments and global content entries the site has, each linking to its manager.
*/
export default class ContentWidget extends DashboardWidget {
  static properties = {
    ...DashboardWidget.properties,
    counts: { state: true }
  };

  constructor(){
    super();
    this.counts = [];
    this.cta = { label: 'Manage content', icon: 'content', href: '/admin/content/templates' };
  }

  /*
    Public Methods
  */

  load = async () => {
    const [templates, fragments, globals] = await Promise.all([
      this.unwrap(listTemplates()),
      this.unwrap(listFragments()),
      this.unwrap(listGlobalContent())
    ]);
    this.counts = [
      { label: 'Templates', total: templates.total, href: '/admin/content/templates' },
      { label: 'Fragments', total: fragments.total, href: '/admin/content/fragments' },
      { label: 'Global content', total: globals.total, href: '/admin/content/globals' }
    ];
  };

  /*
    Rendering
  */

  renderContent(){
    if(!this.counts.some(({ total }) => total)) return html`<p class="tc-muted">No templates, fragments or global content yet.</p>`;
    return html`${this.counts.map(({ label, total, href }) => html`
      <a class="d-f pyq bb" href=${href}><span class="flex">${label}</span><strong>${total}</strong></a>
    `)}`;
  }
}

customElements.define('k-widget-content', ContentWidget);
