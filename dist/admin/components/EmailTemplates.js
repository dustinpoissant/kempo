import t from"/kempo-ui/components/ShadowComponent.js";import{html as e,nothing as s}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Spinner.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Dialog.js";import"/kempo-ui/components/CodeEditor.js";import i from"/kempo-ui/components/Toast.js";import{listEmailTemplates as a,getEmailTemplate as o,saveEmailTemplate as r,resetEmailTemplate as n}from"/kempo/sdk.js";export default class l extends t{static properties={owner:{type:String},previewUrl:{type:String,attribute:"preview-url"},templates:{state:!0},error:{state:!0},editing:{state:!0},saving:{state:!0}};constructor(){super(),this.owner="",this.previewUrl="/kempo/api/email-templates/preview",this.templates=null,this.error="",this.editing=null,this.saving=!1}connectedCallback(){super.connectedCallback();const t=this.closest("k-tab-content");!t||t.active?this.load():this.closest("k-tabs")?.addEventListener("tabfirstshown",({detail:e})=>{e.tab===t.name&&this.load()})}load=async()=>{const[t,e]=await a(this.owner);t?this.error=t.msg:this.templates=e.templates};edit=async t=>{const[e,s]=await o(t);e?i.error(e.msg):(this.editing=s,await this.updateComplete,this.renderRoot.querySelector("#emailDialog").open())};confirmSave=t=>{t.keepDialogOpen=!0,this.save()};save=async()=>{this.saving=!0;const[t]=await r({template:this.editing.template,source:this.renderRoot.querySelector("#emailEditor").value});this.saving=!1,t?i.error(t.msg):(this.renderRoot.querySelector("#emailDialog").close(),i.success("Email template saved"),await this.load())};reset=async()=>{this.saving=!0;const[t]=await n(this.editing.template);this.saving=!1,t?i.error(t.msg):(this.renderRoot.querySelector("#emailDialog").close(),i.success("Email template reset to the default"),await this.load())};renderDialog(){const t=this.editing;return t?e`
      <k-dialog id="emailDialog" style="--width: 60rem;" confirm-text=${this.saving?"Saving…":"Save"} confirm-classes="primary ml" cancel-text="Cancel" .confirmAction=${this.confirmSave}>
        <h2 slot="title" class="h5 pyh px m0">${t.title||t.name}</h2>
        <div class="p">
          <p class="tc-muted mb">${t.template}. Saving keeps your copy in <strong>templates/emails</strong>, which is used from the next email and is not changed by updates. A template that does not render is not saved.</p>
          <k-code-editor id="emailEditor" class="r b mb" language="html" .value=${t.source} style="height: 55vh; min-height: 300px;"></k-code-editor>
          ${t.overridden?e`<button type="button" class="danger" ?disabled=${this.saving} @click=${this.reset}>Reset to default</button>`:s}
        </div>
      </k-dialog>
    `:s}render(){return this.error?e`<p class="tc-danger" role="alert">${this.error}</p>`:this.templates?this.templates.length?e`
      <table class="mb">
        <thead><tr><th>Email</th><th>Template</th><th>Status</th><th></th></tr></thead>
        <tbody>${this.templates.map(t=>e`<tr>
          <td>${t.title||t.name}</td>
          <td class="tc-muted">${t.template}</td>
          <td>${t.overridden?e`<span class="tc-warning">Customized</span>`:e`<span class="tc-muted">Default</span>`}</td>
          <td class="ta-right">
            <a class="btn" href=${`${this.previewUrl}?template=${encodeURIComponent(t.template)}`} target="email-preview">Preview</a>
            <button aria-label="Edit" title="Edit" @click=${()=>this.edit(t.template)}><k-icon name="edit"></k-icon></button>
          </td>
        </tr>`)}</tbody>
      </table>
      ${this.renderDialog()}
    `:e`<p class="tc-muted">There are no email templates here.</p>`:e`<k-spinner></k-spinner>`}}customElements.define("k-email-templates",l);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\EmailTemplates.js.map