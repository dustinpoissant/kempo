import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Spinner.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Dialog.js';
import '/kempo-ui/components/CodeEditor.js';
import '/kempo-ui/components/Table.js';
import '/kempo-ui/components/controls/TcOpen.js';
import '/admin/components/tableControls/EditEmailTemplate.js';
import Toast from '/kempo-ui/components/Toast.js';
import { listEmailTemplates, getEmailTemplate, saveEmailTemplate, resetEmailTemplate } from '/kempo/sdk.js';

const fields = [
  { name: 'title', label: 'Email', editable: false, calculator: template => template.title || template.name },
  { name: 'template', label: 'Template', size: 260, editable: false, calculator: template => template.template },
  { name: 'status', label: 'Status', size: 130, editable: false, calculator: template => template.overridden ? 'Customized' : 'Default' },
];

/*
  The email templates of one extension, to edit, served at /admin/components/EmailTemplates.js:

    <script type="module" src="/admin/components/EmailTemplates.js"></script>
    <k-email-templates owner="kempo-commerce"></k-email-templates>

  Without `owner` it lists kempo's own templates (verify-email, reset-password). Each row opens a dialog with the template in
  a code editor. Saving writes the site's own copy to `templates/emails/<owner>/<name>.page.html`, which is used from the next
  email on and survives updates of the extension; **Reset to default** removes it. The packaged template is never changed.

  **Preview** opens the template as it would be sent, in one named tab that each preview replaces. By default that is kempo's
  preview, which draws it with no data; an extension that can do better (its own orders as the data) serves its own and gives
  its address as `preview-url`:

    <k-email-templates owner="kempo-commerce" preview-url="/commerce/api/emails/preview"></k-email-templates>

  The preview is the saved template, not what is being typed in the editor.
  An extension puts this on its settings page; it needs no code of its own.
*/
export default class EmailTemplates extends ShadowComponent {
  static properties = {
    owner: { type: String },
    previewUrl: { type: String, attribute: 'preview-url' },
    templates: { state: true },
    error: { state: true },
    editing: { state: true },
    saving: { state: true },
  };

  constructor(){
    super();
    this.owner = '';
    this.previewUrl = '/kempo/api/email-templates/preview';
    this.templates = null;
    this.error = '';
    this.editing = null;
    this.saving = false;
  }

  /*
    Lifecycle
  */
  connectedCallback(){
    super.connectedCallback();
const pane = this.closest('k-tab-content');
    // Loads when its tab is first opened, so a tab nobody opens makes no requests.
    if(!pane || pane.active) this.load();
    else this.closest('k-tabs')?.addEventListener('tabfirstshown', ({ detail }) => {
      if(detail.tab === pane.name) this.load();
    });
  }

  /*
    Actions
  */
  load = async () => {
    const [error, data] = await listEmailTemplates(this.owner);
    if(error){
      this.error = error.msg;
      return;
    }
    this.templates = data.templates;
  };

  edit = async template => {
    const [error, found] = await getEmailTemplate(template);
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.editing = found;
    await this.updateComplete;
    this.renderRoot.querySelector('#emailDialog').open();
  };

  /* The dialog's Save button: it stays open until the template is saved, so a template that does not render is not lost. */
  confirmSave = event => {
    event.keepDialogOpen = true;
    this.save();
  };

  save = async () => {
    this.saving = true;
    const [error] = await saveEmailTemplate({ template: this.editing.template, source: this.renderRoot.querySelector('#emailEditor').value });
    this.saving = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.renderRoot.querySelector('#emailDialog').close();
    Toast.success('Email template saved');
    await this.load();
  };

  reset = async () => {
    this.saving = true;
    const [error] = await resetEmailTemplate(this.editing.template);
    this.saving = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.renderRoot.querySelector('#emailDialog').close();
    Toast.success('Email template reset to the default');
    await this.load();
  };

  /*
    Rendering
  */
  renderDialog(){
    const template = this.editing;
    if(!template) return nothing;
    return html`
      <k-dialog id="emailDialog" style="--width: 60rem;" confirm-text=${this.saving ? 'Saving…' : 'Save'} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmSave}>
        <h2 slot="title" class="h5 pyh px m0">${template.title || template.name}</h2>
        <div class="p">
          <p class="tc-muted mb">${template.template}. Saving keeps your copy in <strong>templates/emails</strong>, which is used from the next email and is not changed by updates. A template that does not render is not saved.</p>
          <k-code-editor id="emailEditor" class="r b mb" language="html" .value=${template.source} style="height: 55vh; min-height: 300px;"></k-code-editor>
          ${template.overridden ? html`<button type="button" class="danger" ?disabled=${this.saving} @click=${this.reset}>Reset to default</button>` : nothing}
        </div>
      </k-dialog>
    `;
  }

  /* Refills the table whenever the list or the preview address changes. */
  updated(changed){
    if(!changed.has('templates') && !changed.has('previewUrl')) return;
    const $table = this.renderRoot.querySelector('k-table');
    if(!$table || !this.templates) return;
    $table.setData({
      records: this.templates.map(template => ({ ...template, _url: `${this.previewUrl}?template=${encodeURIComponent(template.template)}` })),
      fields,
    });
  }

  render(){
    if(this.error) return html`<p class="tc-danger" role="alert">${this.error}</p>`;
    if(!this.templates) return html`<k-spinner></k-spinner>`;
    if(!this.templates.length) return html`<p class="tc-muted">There are no email templates here.</p>`;
    return html`
      <k-table class="mb" placeholder="There are no email templates here." @editTemplate=${event => this.edit(event.detail.record.template)}>
        <kc-tc-open slot="after" target="_blank" title="Preview"></kc-tc-open>
        <admin-edit-email-template slot="after"></admin-edit-email-template>
      </k-table>
      ${this.renderDialog()}
    `;
  }
}

customElements.define('k-email-templates', EmailTemplates);
