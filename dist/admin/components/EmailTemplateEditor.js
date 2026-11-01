import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,nothing as s}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Spinner.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/CodeEditor.js";import a from"/kempo-ui/components/Toast.js";import{previewEmailTemplate as i}from"/admin/components/emailPreview.js";import{getEmailTemplate as l,saveEmailTemplate as o,resetEmailTemplate as r,listEmailStylesheets as n,setEmailTemplateStylesheet as m}from"/kempo/sdk.js";export default class c extends e{static properties={template:{state:!0},error:{state:!0},saving:{state:!0},stylesheets:{state:!0}};constructor(){super(),this.template=null,this.error="",this.saving=!1,this.stylesheets=[]}connectedCallback(){super.connectedCallback(),this.load()}load=async()=>{const e=new URLSearchParams(location.search).get("template")??"",[[t,s],[,a]]=await Promise.all([l(e),n()]);t?this.error=t.msg:(this.stylesheets=a?.stylesheets??[],this.template=s,document.title=`${s.title||s.template} - Admin`)};chooseStyle=async e=>{const t=e.target,[s]=await m({template:this.template.template,stylesheet:t.value});if(s)return a.error(s.msg),void await this.load();a.success("Email style chosen"),this.template={...this.template,stylesheet:t.value}};save=async()=>{this.saving=!0;const[e]=await o({template:this.template.template,source:this.renderRoot.querySelector("#emailEditor").value});this.saving=!1,e?a.error(e.msg):(a.success("Email template saved"),await this.load())};reset=async()=>{this.saving=!0;const[e]=await r(this.template.template);this.saving=!1,e?a.error(e.msg):(a.success("Email template reset to the default"),await this.load())};renderVariables(){const e=this.template.variables??[];return e.length?t`
      <table class="mb">
        <tr><th>Variable</th><th>What it holds</th></tr>
        ${e.map(e=>t`<tr><td><code>{{${e.name}}}</code></td><td>${e.description}</td></tr>`)}
      </table>
    `:t`<p class="tc-muted mb">This email declares no variables.</p>`}render(){if(this.error)return t`<p class="tc-danger" role="alert">${this.error}</p>`;if(!this.template)return t`<k-spinner></k-spinner>`;const e=this.template;return t`
      <p class="mb"><a href="/admin/emails#templates">Back to the templates</a></p>
      <h1 class="mb0">${e.title||e.template}</h1>
      <p class="tc-muted mb"><code>${e.template}</code>${e.owner?t` · from ${e.owner}`:s}${e.overridden?t` · customized`:s}</p>

      <label class="d-b mbq" for="styleSelect">Style<small class="d-b tc-muted">The stylesheet this email is drawn with. It is saved when you change it.</small></label>
      <select id="styleSelect" class="mb" ?disabled=${this.saving} @change=${this.chooseStyle}>
        ${this.stylesheets.map(s=>t`<option value=${s.name} ?selected=${s.name===e.stylesheet}>${s.name}${s.description?` – ${s.description}`:""}</option>`)}
      </select>

      <h3>Variables</h3>
      <p class="tc-muted">Put a variable in the email as <code>{{name}}</code>. Show a part only when a variable has a value with <code>&lt;if condition="name"&gt;…&lt;/if&gt;</code>.</p>
      ${this.renderVariables()}

      <h3>Email</h3>
      <k-code-editor id="emailEditor" class="r b mb" language="html" .value=${e.source} style="height: 55vh; min-height: 300px;"></k-code-editor>
      <p class="d-f mb" style="gap: var(--spacer_h); flex-wrap: wrap;">
        <button class="primary" ?disabled=${this.saving} @click=${this.save}>${this.saving?"Saving…":"Save"}</button>
        <button type="button" @click=${()=>i(e.template,e.title)}><k-icon name="visibility"></k-icon> Preview</button>
        ${e.overridden?t`<button class="danger" ?disabled=${this.saving} @click=${this.reset}>Reset to default</button>`:s}
      </p>
    `}}customElements.define("k-email-template-editor",c);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\EmailTemplateEditor.js.map