import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, nothing } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Spinner.js';
import '/kempo-ui/components/Dialog.js';
import Toast from '/kempo-ui/components/Toast.js';
import { listEmails, getEmail, retryEmail, sendTestEmail, getAllCurrentUserPermissions } from '/kempo/sdk.js';

/*
  The log of emails, served at /admin/components/Emails.js:

    <k-admin-emails></k-admin-emails>

  Every email kempo was asked to send is here, newest first, with how it went: `queued` (waiting for a sender or a retry), `sending`,
  `sent` or `failed`. Click one to read it, with what it said and the reason it did not go. Someone who can manage emails can try a
  waiting or failed one again and send a test email, which is the quickest way to see that an email extension is set up.
*/
const PAGE_SIZE = 25;
const STATUS_CLASS = { sent: 'tc-success', failed: 'tc-danger', sending: 'tc-warning', queued: 'tc-muted' };

const when = value => (value ? new Date(value).toLocaleString() : '');

export default class Emails extends ShadowComponent {
  static properties = {
    emails: { state: true },
    total: { state: true },
    offset: { state: true },
    status: { state: true },
    search: { state: true },
    loading: { state: true },
    error: { state: true },
    canManage: { state: true },
    open: { state: true },
    testTo: { state: true },
    busy: { state: true },
  };

  constructor(){
    super();
    this.emails = [];
    this.total = 0;
    this.offset = 0;
    this.status = '';
    this.search = '';
    this.loading = true;
    this.error = '';
    this.canManage = false;
    this.open = null;
    this.testTo = '';
    this.busy = false;
  }

  /*
    Lifecycle
  */
  connectedCallback(){
    super.connectedCallback();
    getAllCurrentUserPermissions().then(([, data]) => { this.canManage = (data?.permissions ?? []).includes('system:emails:manage'); });
    this.load();
  }

  /*
    Loading
  */
  load = async () => {
    this.loading = true;
    const [error, data] = await listEmails({ status: this.status || undefined, search: this.search || undefined, limit: PAGE_SIZE, offset: this.offset });
    this.loading = false;
    if(error){
      this.error = error.msg || 'The emails could not be loaded';
      return;
    }
    this.error = '';
    this.emails = data.emails;
    this.total = data.total;
  };

  filter = async changes => {
    Object.assign(this, changes, { offset: 0 });
    await this.load();
  };

  page = async step => {
    this.offset = Math.max(0, this.offset + step * PAGE_SIZE);
    await this.load();
  };

  /*
    One email
  */
  show = async id => {
    const [error, found] = await getEmail(id);
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.open = found;
    await this.updateComplete;
    this.renderRoot.querySelector('#emailDialog').open();
  };

  retry = async () => {
    this.busy = true;
    const [error, result] = await retryEmail(this.open.id);
    this.busy = false;
    if(error) Toast.error(error.msg);
    else if(result.sent) Toast.success('The email was sent');
    else Toast.error(result.error || 'The email could not be sent');
    this.renderRoot.querySelector('#emailDialog').close();
    await this.load();
  };

  /*
    Test email
  */
  openTest = () => this.renderRoot.querySelector('#testDialog').open();

  confirmTest = event => {
    event.keepDialogOpen = true;
    this.sendTest();
  };

  sendTest = async () => {
    this.busy = true;
    const [error, result] = await sendTestEmail(this.testTo.trim());
    this.busy = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.renderRoot.querySelector('#testDialog').close();
    if(result.sent) Toast.success(`A test email was sent to ${this.testTo.trim()}`);
    else Toast.error(result.error || 'The test email could not be sent');
    await this.load();
  };

  /*
    Rendering
  */
  renderDetail(){
    const mail = this.open;
    if(!mail) return nothing;
    return html`
      <k-dialog id="emailDialog" style="--width: 60rem;" cancel-text="Close">
        <h2 slot="title" class="h5 pyh px m0">${mail.subject}</h2>
        <div class="p">
          <p class="mb"><strong class=${STATUS_CLASS[mail.status] ?? ''}>${mail.status}</strong>${mail.attempts ? html` · ${mail.attempts} ${mail.attempts === 1 ? 'try' : 'tries'}` : nothing}${mail.provider ? html` · sent by ${mail.provider}` : nothing}</p>
          <p class="mb">To <strong>${mail.recipient}</strong>, from ${mail.sender}<br><span class="tc-muted">${mail.type} · created ${when(mail.createdAt)}${mail.sentAt ? ` · sent ${when(mail.sentAt)}` : ''}</span></p>
          ${mail.lastError ? html`<p class="tc-danger mb" role="alert">${mail.lastError}</p>` : nothing}
          ${this.canManage && ['queued', 'failed'].includes(mail.status) ? html`<p class="mb"><button class="primary" ?disabled=${this.busy} @click=${this.retry}>${this.busy ? 'Trying…' : 'Try again'}</button></p>` : nothing}
          <iframe title="The email" sandbox="" .srcdoc=${mail.html} class="full b r" height="420"></iframe>
        </div>
      </k-dialog>
    `;
  }

  renderTest(){
    return html`
      <k-dialog id="testDialog" confirm-text=${this.busy ? 'Sending…' : 'Send test email'} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmTest}>
        <h2 slot="title" class="h5 pyh px m0">Send a test email</h2>
        <div class="p">
          <label class="mb d-b">Send it to<input type="email" .value=${this.testTo} @input=${event => { this.testTo = event.target.value; }}></label>
          <p class="tc-muted">It goes out through the email extension that is installed, and shows in the log below.</p>
        </div>
      </k-dialog>
    `;
  }

  render(){
    const last = Math.min(this.offset + PAGE_SIZE, this.total);
    return html`
      <div class="d-f mb">
        <label class="mr">Status
          <select @change=${event => this.filter({ status: event.target.value })}>
            ${['', 'queued', 'sending', 'sent', 'failed'].map(status => html`<option value=${status} ?selected=${this.status === status}>${status || 'All'}</option>`)}
          </select>
        </label>
        <label class="mr">Search
          <input type="search" placeholder="Address or subject" .value=${this.search} @change=${event => this.filter({ search: event.target.value })}>
        </label>
        ${this.canManage ? html`<button class="mb" @click=${this.openTest}>Send a test email</button>` : nothing}
      </div>
      ${this.error ? html`<p class="tc-danger" role="alert">${this.error}</p>` : nothing}
      ${this.loading ? html`<k-spinner></k-spinner>` : this.emails.length ? html`
        <table class="mb">
          <thead><tr><th>Status</th><th>To</th><th>Subject</th><th>Type</th><th>Created</th></tr></thead>
          <tbody>${this.emails.map(mail => html`<tr>
            <td><strong class=${STATUS_CLASS[mail.status] ?? ''}>${mail.status}</strong></td>
            <td>${mail.recipient}</td>
            <td><a href="#" @click=${event => { event.preventDefault(); this.show(mail.id); }}>${mail.subject}</a>${mail.lastError ? html`<br><span class="tc-danger">${mail.lastError}</span>` : nothing}</td>
            <td class="tc-muted">${mail.type}</td>
            <td class="tc-muted">${when(mail.createdAt)}</td>
          </tr>`)}</tbody>
        </table>
        <p class="d-f mb"><button ?disabled=${this.offset === 0} @click=${() => this.page(-1)}>Newer</button><span class="tc-muted ph">${this.offset + 1}–${last} of ${this.total}</span><button ?disabled=${last >= this.total} @click=${() => this.page(1)}>Older</button></p>
      ` : html`<p class="tc-muted">No emails have been sent yet.</p>`}
      ${this.renderDetail()}
      ${this.renderTest()}
    `;
  }
}

customElements.define('k-admin-emails', Emails);
