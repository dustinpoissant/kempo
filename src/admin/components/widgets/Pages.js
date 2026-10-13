import DashboardWidget from '/kempo/components/DashboardWidget.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import { listPages, listTemplates, createPage } from '/kempo/sdk.js';

/*
  Page totals and the pages edited most recently. Shows more rows the taller the tile is.
*/
export default class PagesWidget extends DashboardWidget {
  static properties = {
    ...DashboardWidget.properties,
    total: { state: true },
    disabled: { state: true },
    recent: { state: true }
  };

  constructor(){
    super();
    this.total = 0;
    this.disabled = 0;
    this.recent = [];
    this.cta = { label: 'New page', icon: 'add', permission: 'system:pages:create', onClick: () => this.newPage() };
  }

  /*
    Public Methods
  */

  load = async () => {
    const { pages, total } = await this.unwrap(listPages({ showHidden: true }));
    this.total = total;
    this.disabled = pages.filter(page => page.disabled).length;
    this.recent = pages.slice().sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  };

  /*
    Event Handlers
  */

  /*
    Creates a page at the site root from a template and opens it in the editor. The Pages screen has the
    full dialog, including choosing another directory.
  */
  newPage = async () => {
    const { templates } = await this.unwrap(listTemplates());
    this.openForm({
      title: 'New page',
      confirmText: 'Create',
      fields: [
        { name: 'name', label: 'Page name', placeholder: 'My new page' },
        { name: 'template', label: 'Template', type: 'select', value: 'default', options: templates.map(({ name }) => ({ value: name, label: name })) }
      ],
      submit: async ({ name, template }) => {
        const [error, data] = await createPage({ directory: '', name, template });
        if(error) return error.msg || 'Could not create the page.';
        window.location.href = `/admin/content/pages/edit?path=${encodeURIComponent(data.file.replace(/\.page\.html$/, ''))}`;
      }
    });
  };

  /*
    Rendering
  */

  renderHeader(){
    return html`
      <header class="d-f px pyh bb" style="align-items: center;">
        ${this.renderTitle()}
        ${this.renderActions()}
        <button class="no-btn pq" title="Refresh" aria-label="Refresh pages" @click=${this.refresh}><k-icon name="restart_alt"></k-icon></button>
      </header>
    `;
  }

  renderContent(){
    const rows = this.recent.slice(0, this.height * 3);
    return html`
      <div class="d-f mb">
        <div class="flex"><div class="h2 m0">${this.total}</div><div class="small tc-muted">Pages</div></div>
        <div class="flex"><div class="h2 m0">${this.total - this.disabled}</div><div class="small tc-muted">Enabled</div></div>
        <div class="flex"><div class="h2 m0">${this.disabled}</div><div class="small tc-muted">Disabled</div></div>
      </div>
      ${rows.length ? html`
        <div class="small tc-muted mbq">Recently updated</div>
        ${rows.map(page => html`
          <a class="d-b py bb" href="/admin/content/pages/edit?path=${encodeURIComponent(page.file.replace(/\.page(-disabled)?\.html$/, ''))}">
            ${page.title || page.name || page.url}
            <span class="small tc-muted">${page.url}</span>
          </a>
        `)}
      ` : nothing}
    `;
  }
}

customElements.define('k-widget-pages', PagesWidget);
