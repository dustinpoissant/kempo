import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Spinner.js';
import '/kempo-ui/components/Table.js';
import '/admin/components/tableControls/PreviewEmailTemplate.js';
import { previewEmailTemplate } from '/admin/components/emailPreview.js';
import '/admin/components/tableControls/EditEmailTemplate.js';
import { listEmailTemplates } from '/kempo/sdk.js';

const fields = [
  { name: 'title', label: 'Email', editable: false, calculator: template => template.title || template.name },
  { name: 'template', label: 'Template', size: 260, editable: false, calculator: template => template.template },
  { name: 'status', label: 'Status', size: 130, editable: false, calculator: template => template.overridden ? 'Customized' : 'Default' },
  { name: 'stylesheet', label: 'Style', size: 160, editable: false },
];

/*
  Every email template there is (kempo's and each extension's), or one extension's with `owner`. The row's first control previews the
  email in a new tab; its edit control opens the template's own editor page, which shows what variables it can use. Served at /admin/components/EmailTemplates.js:

    <script type="module" src="/admin/components/EmailTemplates.js"></script>
    <k-email-templates owner="kempo-commerce"></k-email-templates>
*/
export default class EmailTemplates extends ShadowComponent {
  static properties = {
    owner: { type: String },
    templates: { state: true },
    error: { state: true },
  };

  constructor(){
    super();
    this.owner = '';
    this.templates = null;
    this.error = '';
  }

  connectedCallback(){
    super.connectedCallback();
    const pane = this.closest('k-tab-content');
    // Loads when its tab is first opened, so a tab nobody opens makes no requests.
    if(!pane || pane.active) this.load();
    else this.closest('k-tabs')?.addEventListener('tabfirstshown', ({ detail }) => {
      if(detail.tab === pane.name) this.load();
    });
  }

  load = async () => {
    const [error, data] = await listEmailTemplates(this.owner || 'all');
    if(error){
      this.error = error.msg;
      return;
    }
    this.templates = data.templates;
  };

  updated(changed){
    if(!changed.has('templates')) return;
    const $table = this.renderRoot.querySelector('k-table');
    if(!$table || !this.templates) return;
    $table.setData({
      records: this.templates,
      fields,
    });
  }

  render(){
    if(this.error) return html`<p class="tc-danger" role="alert">${this.error}</p>`;
    if(!this.templates) return html`<k-spinner></k-spinner>`;
    if(!this.templates.length) return html`<p class="tc-muted">There are no email templates here.</p>`;
    return html`
      <k-table class="mb" placeholder="There are no email templates here." @editTemplate=${event => { location.href = `/admin/emails/template/?template=${encodeURIComponent(event.detail.record.template)}`; }} @previewTemplate=${event => previewEmailTemplate(event.detail.record.template, event.detail.record.title || event.detail.record.template)}>
        <admin-preview-email-template slot="before"></admin-preview-email-template>
        <admin-edit-email-template slot="after"></admin-edit-email-template>
      </k-table>
    `;
  }
}

customElements.define('k-email-templates', EmailTemplates);
