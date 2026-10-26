import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,nothing as s}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Spinner.js";import"/kempo-ui/components/Dialog.js";import"/kempo-ui/components/Table.js";import"/kempo-ui/components/controls/TcFirstPage.js";import"/kempo-ui/components/controls/TcPrevPage.js";import"/kempo-ui/components/controls/TcNextPage.js";import"/kempo-ui/components/controls/TcLastPage.js";import"/kempo-ui/components/controls/TcPageSelect.js";import"/kempo-ui/components/controls/TcPageSize.js";import"/admin/components/tableControls/ViewEmail.js";import a from"/kempo-ui/components/Toast.js";import{listEmails as i,getEmail as o,retryEmail as r,sendTestEmail as l,getAllCurrentUserPermissions as n}from"/kempo/sdk.js";const c={sent:"tc-success",failed:"tc-danger",sending:"tc-warning",queued:"tc-muted"},m=e=>e?new Date(e).toLocaleString():"",d=[{name:"status",label:"Status",size:110,editable:!1},{name:"recipient",label:"To",size:240,editable:!1},{name:"subject",label:"Subject",editable:!1,calculator:e=>e.lastError?`${e.subject} — ${e.lastError}`:e.subject},{name:"type",label:"Type",size:140,editable:!1},{name:"createdAt",label:"Created",size:190,editable:!1,formatter:m}];export default class p extends e{static properties={status:{state:!0},search:{state:!0},loading:{state:!0},error:{state:!0},canManage:{state:!0},open:{state:!0},testTo:{state:!0},busy:{state:!0}};constructor(){super(),this.status="",this.search="",this.loading=!0,this.error="",this.canManage=!1,this.open=null,this.testTo="",this.busy=!1}connectedCallback(){super.connectedCallback(),n().then(([,e])=>{this.canManage=(e?.permissions??[]).includes("system:emails:manage")});const e=this.closest("k-tab-content");!e||e.active?this.load():this.closest("k-tabs")?.addEventListener("tabfirstshown",({detail:t})=>{t.tab===e.name&&this.load()})}load=async()=>{await this.updateComplete;const e=this.renderRoot.querySelector("#emails"),t={status:this.status||void 0,search:this.search||void 0};this.loading=!0;const[s,a]=await i({...t,limit:25,offset:0});this.loading=!1,s?this.error=s.msg||"The emails could not be loaded":(this.error="",e.setData({records:a.emails,fields:d}),e.setupFetchRecords(a.total,async(e,s)=>{const[a,o]=await i({...t,limit:s,offset:e});return a?[]:o.emails}))};filter=e=>{Object.assign(this,e),this.load()};show=async e=>{const[t,s]=await o(e);t?a.error(t.msg):(this.open=s,await this.updateComplete,this.renderRoot.querySelector("#emailDialog").open())};retry=async()=>{this.busy=!0;const[e,t]=await r(this.open.id);this.busy=!1,e?a.error(e.msg):t.sent?a.success("The email was sent"):a.error(t.error||"The email could not be sent"),this.renderRoot.querySelector("#emailDialog").close(),await this.load()};openTest=()=>this.renderRoot.querySelector("#testDialog").open();confirmTest=e=>{e.keepDialogOpen=!0,this.sendTest()};sendTest=async()=>{this.busy=!0;const[e,t]=await l(this.testTo.trim());this.busy=!1,e?a.error(e.msg):(this.renderRoot.querySelector("#testDialog").close(),t.sent?a.success(`A test email was sent to ${this.testTo.trim()}`):a.error(t.error||"The test email could not be sent"),await this.load())};renderDetail(){const e=this.open;return e?t`
      <k-dialog id="emailDialog" style="--width: 60rem;" cancel-text="Close">
        <h2 slot="title" class="h5 pyh px m0">${e.subject}</h2>
        <div class="p">
          <p class="mb"><strong class=${c[e.status]??""}>${e.status}</strong>${e.attempts?t` · ${e.attempts} ${1===e.attempts?"try":"tries"}`:s}${e.provider?t` · sent by ${e.provider}`:s}</p>
          <p class="mb">To <strong>${e.recipient}</strong>, from ${e.sender}<br><span class="tc-muted">${e.type} · created ${m(e.createdAt)}${e.sentAt?` · sent ${m(e.sentAt)}`:""}</span></p>
          ${e.lastError?t`<p class="tc-danger mb" role="alert">${e.lastError}</p>`:s}
          ${this.canManage&&["queued","failed"].includes(e.status)?t`<p class="mb"><button class="primary" ?disabled=${this.busy} @click=${this.retry}>${this.busy?"Trying…":"Try again"}</button></p>`:s}
          <iframe title="The email" sandbox="" .srcdoc=${e.html} class="full b r" height="420"></iframe>
        </div>
      </k-dialog>
    `:s}renderTest(){return t`
      <k-dialog id="testDialog" confirm-text=${this.busy?"Sending…":"Send test email"} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmTest}>
        <h2 slot="title" class="h5 pyh px m0">Send a test email</h2>
        <div class="p">
          <label class="mb d-b">Send it to<input type="email" .value=${this.testTo} @input=${e=>{this.testTo=e.target.value}}></label>
          <p class="tc-muted">It goes out through the email extension that is installed, and shows in the log below.</p>
        </div>
      </k-dialog>
    `}render(){return t`
      <div class="d-f mb">
        <label class="mr">Status
          <select @change=${e=>this.filter({status:e.target.value})}>
            ${["","queued","sending","sent","failed"].map(e=>t`<option value=${e} ?selected=${this.status===e}>${e||"All"}</option>`)}
          </select>
        </label>
        <label class="mr">Search
          <input type="search" placeholder="Address or subject" .value=${this.search} @change=${e=>this.filter({search:e.target.value})}>
        </label>
        ${this.canManage?t`<button class="mb" @click=${this.openTest}>Send a test email</button>`:s}
      </div>
      ${this.error?t`<p class="tc-danger" role="alert">${this.error}</p>`:s}
      ${this.loading?t`<k-spinner></k-spinner>`:s}
      <k-table id="emails" enable-pages page-size="25" page-size-options="[10,25,50]" placeholder="No emails have been sent yet." @emailView=${e=>this.show(e.detail.record.id)}>
        <admin-view-email slot="before"></admin-view-email>
        <div class="d-f full" style="align-items: center;">
          <div>
            <kc-tc-first-page></kc-tc-first-page>
            <kc-tc-prev-page></kc-tc-prev-page>
            <kc-tc-next-page></kc-tc-next-page>
            <kc-tc-last-page></kc-tc-last-page>
          </div>
          <div class="flex"></div>
          <div><kc-tc-page-select></kc-tc-page-select></div>
          <div class="flex"></div>
          <div><kc-tc-page-size></kc-tc-page-size></div>
        </div>
      </k-table>
      ${this.renderDetail()}
      ${this.renderTest()}
    `}}customElements.define("k-admin-emails",p);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\Emails.js.map