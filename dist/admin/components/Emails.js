import t from"/kempo-ui/components/ShadowComponent.js";import{html as s,nothing as e}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Spinner.js";import"/kempo-ui/components/Dialog.js";import a from"/kempo-ui/components/Toast.js";import{listEmails as i,getEmail as o,retryEmail as r,sendTestEmail as l,getAllCurrentUserPermissions as n}from"/kempo/sdk.js";const c={sent:"tc-success",failed:"tc-danger",sending:"tc-warning",queued:"tc-muted"},h=t=>t?new Date(t).toLocaleString():"";export default class d extends t{static properties={emails:{state:!0},total:{state:!0},offset:{state:!0},status:{state:!0},search:{state:!0},loading:{state:!0},error:{state:!0},canManage:{state:!0},open:{state:!0},testTo:{state:!0},busy:{state:!0}};constructor(){super(),this.emails=[],this.total=0,this.offset=0,this.status="",this.search="",this.loading=!0,this.error="",this.canManage=!1,this.open=null,this.testTo="",this.busy=!1}connectedCallback(){super.connectedCallback(),n().then(([,t])=>{this.canManage=(t?.permissions??[]).includes("system:emails:manage")}),this.load()}load=async()=>{this.loading=!0;const[t,s]=await i({status:this.status||void 0,search:this.search||void 0,limit:25,offset:this.offset});this.loading=!1,t?this.error=t.msg||"The emails could not be loaded":(this.error="",this.emails=s.emails,this.total=s.total)};filter=async t=>{Object.assign(this,t,{offset:0}),await this.load()};page=async t=>{this.offset=Math.max(0,this.offset+25*t),await this.load()};show=async t=>{const[s,e]=await o(t);s?a.error(s.msg):(this.open=e,await this.updateComplete,this.renderRoot.querySelector("#emailDialog").open())};retry=async()=>{this.busy=!0;const[t,s]=await r(this.open.id);this.busy=!1,t?a.error(t.msg):s.sent?a.success("The email was sent"):a.error(s.error||"The email could not be sent"),this.renderRoot.querySelector("#emailDialog").close(),await this.load()};openTest=()=>this.renderRoot.querySelector("#testDialog").open();confirmTest=t=>{t.keepDialogOpen=!0,this.sendTest()};sendTest=async()=>{this.busy=!0;const[t,s]=await l(this.testTo.trim());this.busy=!1,t?a.error(t.msg):(this.renderRoot.querySelector("#testDialog").close(),s.sent?a.success(`A test email was sent to ${this.testTo.trim()}`):a.error(s.error||"The test email could not be sent"),await this.load())};renderDetail(){const t=this.open;return t?s`
      <k-dialog id="emailDialog" style="--width: 60rem;" cancel-text="Close">
        <h2 slot="title" class="h5 pyh px m0">${t.subject}</h2>
        <div class="p">
          <p class="mb"><strong class=${c[t.status]??""}>${t.status}</strong>${t.attempts?s` · ${t.attempts} ${1===t.attempts?"try":"tries"}`:e}${t.provider?s` · sent by ${t.provider}`:e}</p>
          <p class="mb">To <strong>${t.recipient}</strong>, from ${t.sender}<br><span class="tc-muted">${t.type} · created ${h(t.createdAt)}${t.sentAt?` · sent ${h(t.sentAt)}`:""}</span></p>
          ${t.lastError?s`<p class="tc-danger mb" role="alert">${t.lastError}</p>`:e}
          ${this.canManage&&["queued","failed"].includes(t.status)?s`<p class="mb"><button class="primary" ?disabled=${this.busy} @click=${this.retry}>${this.busy?"Trying…":"Try again"}</button></p>`:e}
          <iframe title="The email" sandbox="" .srcdoc=${t.html} class="full b r" height="420"></iframe>
        </div>
      </k-dialog>
    `:e}renderTest(){return s`
      <k-dialog id="testDialog" confirm-text=${this.busy?"Sending…":"Send test email"} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmTest}>
        <h2 slot="title" class="h5 pyh px m0">Send a test email</h2>
        <div class="p">
          <label class="mb d-b">Send it to<input type="email" .value=${this.testTo} @input=${t=>{this.testTo=t.target.value}}></label>
          <p class="tc-muted">It goes out through the email extension that is installed, and shows in the log below.</p>
        </div>
      </k-dialog>
    `}render(){const t=Math.min(this.offset+25,this.total);return s`
      <div class="d-f mb">
        <label class="mr">Status
          <select @change=${t=>this.filter({status:t.target.value})}>
            ${["","queued","sending","sent","failed"].map(t=>s`<option value=${t} ?selected=${this.status===t}>${t||"All"}</option>`)}
          </select>
        </label>
        <label class="mr">Search
          <input type="search" placeholder="Address or subject" .value=${this.search} @change=${t=>this.filter({search:t.target.value})}>
        </label>
        ${this.canManage?s`<button class="mb" @click=${this.openTest}>Send a test email</button>`:e}
      </div>
      ${this.error?s`<p class="tc-danger" role="alert">${this.error}</p>`:e}
      ${this.loading?s`<k-spinner></k-spinner>`:this.emails.length?s`
        <table class="mb">
          <thead><tr><th>Status</th><th>To</th><th>Subject</th><th>Type</th><th>Created</th></tr></thead>
          <tbody>${this.emails.map(t=>s`<tr>
            <td><strong class=${c[t.status]??""}>${t.status}</strong></td>
            <td>${t.recipient}</td>
            <td><a href="#" @click=${s=>{s.preventDefault(),this.show(t.id)}}>${t.subject}</a>${t.lastError?s`<br><span class="tc-danger">${t.lastError}</span>`:e}</td>
            <td class="tc-muted">${t.type}</td>
            <td class="tc-muted">${h(t.createdAt)}</td>
          </tr>`)}</tbody>
        </table>
        <p class="d-f mb"><button ?disabled=${0===this.offset} @click=${()=>this.page(-1)}>Newer</button><span class="tc-muted ph">${this.offset+1}–${t} of ${this.total}</span><button ?disabled=${t>=this.total} @click=${()=>this.page(1)}>Older</button></p>
      `:s`<p class="tc-muted">No emails have been sent yet.</p>`}
      ${this.renderDetail()}
      ${this.renderTest()}
    `}}customElements.define("k-admin-emails",d);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\Emails.js.map