import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Spinner.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Dialog.js';
import '/kempo-ui/components/CodeEditor.js';
import '/kempo-ui/components/Table.js';
import '/kempo-ui/components/controls/TcOpen.js';
import '/kempo-ui/components/controls/TcDeleteRecord.js';
import '/admin/components/tableControls/EditEmailTemplate.js';
import Toast from '/kempo-ui/components/Toast.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import { listEmailStylesheets, getEmailStylesheet, createEmailStylesheet, updateEmailStylesheet, deleteEmailStylesheet } from '/kempo/sdk.js';

const fields = [
  { name: 'name', label: 'Name', size: 220, editable: false },
  { name: 'description', label: 'Description', editable: false },
  { name: 'updatedAt', label: 'Updated', size: 190, editable: false, formatter: value => new Date(value).toLocaleString() },
];

/*
  The email stylesheets, on the Styles tab of the Emails page: a table to make, change and delete them. Each is CSS that every email
  using it is drawn with. The CSS is filtered for what mail clients drop and cut down to what each email uses, so a stylesheet can hold
  more than one email needs. `default` is kempo's own and cannot be deleted.

    <k-email-stylesheets></k-email-stylesheets>
*/
export default class EmailStylesheets extends ShadowComponent {
  static properties = {
    stylesheets: { state: true },
    error: { state: true },
    editing: { state: true },
    saving: { state: true },
  };

  constructor(){
    super();
    this.stylesheets = null;
    this.error = '';
    this.editing = null;
    this.saving = false;
  }

  connectedCallback(){
    super.connectedCallback();
    const pane = this.closest('k-tab-content');
    if(!pane || pane.active) this.load();
    else this.closest('k-tabs')?.addEventListener('tabfirstshown', ({ detail }) => {
      if(detail.tab === pane.name) this.load();
    });
  }

  load = async () => {
    const [error, data] = await listEmailStylesheets();
    if(error){
      this.error = error.msg;
      return;
    }
    this.error = '';
    this.stylesheets = data.stylesheets;
  };

  /* A new stylesheet, or one to change: the dialog is filled from the server so the CSS is the one that is stored. */
  open = async (record = null) => {
    if(!record){
      this.editing = { name: '', description: '', css: '' };
    } else {
      const [error, found] = await getEmailStylesheet(record.name);
      if(error){
        Toast.error(error.msg);
        return;
      }
      this.editing = found.stylesheet;
    }
    await this.updateComplete;
    this.renderRoot.querySelector('#stylesheetDialog').open();
  };

  confirmSave = event => {
    event.keepDialogOpen = true;
    this.save();
  };

  save = async () => {
    const isNew = !this.editing.name;
    const name = (this.renderRoot.querySelector('#stylesheetName')?.value ?? this.editing.name).trim();
    const description = this.renderRoot.querySelector('#stylesheetDescription').value.trim();
    const css = this.renderRoot.querySelector('#stylesheetCss').value;
    if(isNew && !name) return Toast.error('Give the stylesheet a name');

    this.saving = true;
    const [error] = isNew
      ? await createEmailStylesheet({ name, description, css })
      : await updateEmailStylesheet(this.editing.name, { description, css });
    this.saving = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.renderRoot.querySelector('#stylesheetDialog').close();
    Toast.success(isNew ? 'Email stylesheet made' : 'Email stylesheet saved');
    await this.load();
  };

  /* Refused by the table, not just hidden, when it is the default one. */
  requestDelete = ({ detail: { records, approve, reject } }) => {
    const [record] = records;
    if(records.some(entry => entry.builtIn)){
      reject();
      Toast.error('The default email stylesheet cannot be deleted');
      return;
    }
    Dialog.confirm(`<div class="p"><p>Delete the stylesheet "${record.name}"? Emails that use it go back to the default. This cannot be undone.</p></div>`, async confirmed => {
      if(!confirmed){
        reject();
        return;
      }
      const [error] = await deleteEmailStylesheet(record.name);
      if(error){
        reject();
        Toast.error(error.msg);
        return;
      }
      approve();
      Toast.success('Email stylesheet deleted');
      await this.load();
    });
  };

  renderDialog(){
    const sheet = this.editing;
    if(!sheet) return nothing;
    const isNew = !sheet.name;
    return html`
      <k-dialog id="stylesheetDialog" style="--width: 60rem;" confirm-text=${this.saving ? 'Saving…' : 'Save'} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmSave}>
        <h2 slot="title" class="h5 pyh px m0">${isNew ? 'New email stylesheet' : sheet.name}</h2>
        <div class="p">
          ${isNew ? html`
            <label class="d-b mbq" for="stylesheetName">Name<small class="d-b tc-muted">Lowercase letters, digits and dashes. It cannot be changed later.</small></label>
            <input id="stylesheetName" type="text" class="full mb" .value=${sheet.name}>
          ` : nothing}
          <label class="d-b mbq" for="stylesheetDescription">Description<small class="d-b tc-muted">What it is for, shown in the table.</small></label>
          <input id="stylesheetDescription" type="text" class="full mb" .value=${sheet.description ?? ''}>
          <label class="d-b mbq">CSS<small class="d-b tc-muted">Only what mail clients keep is used. Pseudo-classes, page-level rules, animation and colour functions are dropped.</small></label>
          <k-code-editor id="stylesheetCss" class="r b" language="css" .value=${sheet.css ?? ''} style="height: 50vh; min-height: 260px;"></k-code-editor>
        </div>
      </k-dialog>
    `;
  }

  /* Refills the table whenever the list changes, the same way the email templates table is filled. */
  updated(changed){
    if(!changed.has('stylesheets')) return;
    const $table = this.renderRoot.querySelector('k-table');
    if(!$table || !this.stylesheets) return;
    $table.setData({
      records: this.stylesheets,
      fields,
    });
  }

  render(){
    if(this.error) return html`<p class="tc-danger" role="alert">${this.error}</p>`;
    if(!this.stylesheets) return html`<k-spinner></k-spinner>`;
    return html`
      <div class="d-f mb" style="align-items: center; gap: var(--spacer_h); flex-wrap: wrap;">
        <p class="tc-muted m0 flex">Each email is drawn with one of these. An email with no choice uses the default.</p>
        <button class="primary" @click=${() => this.open()}><k-icon name="add"></k-icon> New stylesheet</button>
      </div>
      <k-table class="mb" placeholder="There are no email stylesheets." request-delete enable-selection @requestDelete=${this.requestDelete} @editTemplate=${event => this.open(event.detail.record)}>
        <admin-edit-email-template slot="after"></admin-edit-email-template>
        <kc-tc-delete-record slot="after"></kc-tc-delete-record>
      </k-table>
      ${this.renderDialog()}
    `;
  }
}

customElements.define('k-email-stylesheets', EmailStylesheets);
