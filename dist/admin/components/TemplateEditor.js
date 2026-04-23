import ShadowComponent from"/kempo-ui/components/ShadowComponent.js";import{html}from"/kempo-ui/lit-all.min.js";import{getTemplate,updateTemplate,deleteTemplates,moveTemplate,createTemplate,listDirectories}from"/kempo/sdk.js";import Dialog from"/kempo-ui/components/Dialog.js";import Toast from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Accordion.js";import"/kempo-ui/components/CodeEditor.js";export default class TemplateEditor extends ShadowComponent{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},template:{state:!0}};constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.template=null,this.file=""}async connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown);const e=new URLSearchParams(window.location.search).get("template");if(this.file=e+".template.html",!this.file||".template.html"===this.file)return this.loading=!1,void(this.error=!0);const[t,a]=await getTemplate(this.file);this.loading=!1,t?this.error=!0:(this.template=a,document.title=`Edit: ${a.name} - Admin`)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}getFormState(){const e=this.shadowRoot;return{name:e.querySelector("#metaName")?.value??this.template.name,markup:e.querySelector("#templateEditor")?.getValue()??this.template.markup}}handleKeyDown=e=>{(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.saving||this.template?.locked||this.handleSave())};handleDelete=()=>{Dialog.confirm("Delete this template? This action cannot be undone.",async e=>{if(!e)return;const[t]=await deleteTemplates([this.file]);t?Toast.error(t.msg||"Failed to delete template"):(Toast.success("Template deleted"),setTimeout(()=>{window.location.href="/admin/content/templates"},1e3))})};handleMove=async()=>{const[,e]=await listDirectories(),t=e?.directories||["."],a=this.file.replace(/\.template\.html$/,"").split("/"),l=a.pop(),i=a.join("/")||".",o=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",n="."===i?"/":"/"+i,s=Dialog.create(html`
      <div class="p">
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="warning"></k-icon>
          <strong>Warning:</strong> Moving a template may break pages that reference it by name.<br />Pages search for templates by name starting from their own directory up to the root.<br />Moving this template could cause those pages to fall back to the <code>default</code> template.
        </div>
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${n}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${t.map(e=>html`<option value="${"."===e?"/":"/"+e}">`)} 
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Template Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${l}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `,{title:"Move Template",confirmText:"Save and Move Template",confirmAction:async()=>{const e=s.querySelector("#dlg-move-dir").value.trim()||"/",t=s.querySelector("#dlg-move-name").value.trim();if(!t)return void Toast.error("Template name is required");if(!/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(a=e)||a.includes("..")||a.includes("//"))return void Toast.error("Invalid directory path");var a;const l=o(e),i="."===l?`${t}.template.html`:`${l}/${t}.template.html`;this.saving=!0;const[n]=await updateTemplate({file:this.file,...this.getFormState()});if(this.saving=!1,n)return void Toast.error(n.msg||"Failed to save template");const[r,m]=await moveTemplate({file:this.file,newFile:i});if(r)return void Toast.error(r.msg||"Failed to move template");Toast.success("Template saved and moved");const d=m.file.replace(/\.template\.html$/,"");setTimeout(()=>{window.location.href=`/admin/content/templates/edit?template=${encodeURIComponent(d)}`},1e3)},cancelText:"Cancel"}),r=()=>{const e=o(s.querySelector("#dlg-move-dir").value||"/"),t=s.querySelector("#dlg-move-name").value,a="."===e?"/":"/"+e+"/";s.querySelector("#dlg-move-preview").textContent=t?a+t:""};s.querySelector("#dlg-move-dir").addEventListener("input",r),s.querySelector("#dlg-move-name").addEventListener("input",r),r()};handleCopy=async()=>{const[,e]=await listDirectories(),t=e?.directories||["."],a=this.file.replace(/\.template\.html$/,"").split("/"),l=a.pop(),i=a.join("/")||".",o=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",n="."===i?"/":"/"+i,s=Dialog.create(html`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-copy-dir" class="full" list="dlg-copy-dir-list" .value="${n}" placeholder="/">
          <datalist id="dlg-copy-dir-list">
            ${t.map(e=>html`<option value="${"."===e?"/":"/"+e}">`)} 
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Template Name</strong></label>
          <input type="text" id="dlg-copy-name" class="full" .value="${l}-copy">
          <p class="mt-sm muted"><small id="dlg-copy-preview"></small></p>
        </div>
      </div>
    `,{title:"Copy Template",confirmText:"Copy Template",confirmAction:async()=>{const e=s.querySelector("#dlg-copy-dir").value.trim()||"/",t=s.querySelector("#dlg-copy-name").value.trim();if(!t)return void Toast.error("Template name is required");if(!/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(a=e)||a.includes("..")||a.includes("//"))return void Toast.error("Invalid directory path");var a;const l=o(e),[i,n]=await createTemplate({directory:"."===l?"":l,name:t,copyFrom:this.file});i?Toast.error(i.msg||"Failed to copy template"):(Toast.success("Template copied"),setTimeout(()=>{window.location.href=`/admin/content/templates/edit?template=${encodeURIComponent(n.file.replace(/\.template\.html$/,""))}`},1e3))},cancelText:"Cancel"}),r=()=>{const e=o(s.querySelector("#dlg-copy-dir").value||"/"),t=s.querySelector("#dlg-copy-name").value,a="."===e?"/":"/"+e+"/";s.querySelector("#dlg-copy-preview").textContent=t?a+t:""};s.querySelector("#dlg-copy-dir").addEventListener("input",r),s.querySelector("#dlg-copy-name").addEventListener("input",r),r()};handleReset=()=>{Dialog.confirm("Reset this template? Any unsaved changes will be lost.",e=>{e&&(this.template={...this.template})})};handleSave=async()=>{this.saving=!0;const e=this.getFormState(),[t,a]=await updateTemplate({file:this.file,markup:e.markup});if(this.saving=!1,t)return void Toast.error(t.msg||"Failed to save template");this.template={...this.template,markup:e.markup,updatedAt:a.updatedAt};const l=this.file.replace(/\.template\.html$/,"").split("/"),i=l.pop(),o=l.join("/"),n=e.name.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");if(n&&n!==i){const e=o?`${o}/${n}.template.html`:`${n}.template.html`,[t,a]=await moveTemplate({file:this.file,newFile:e});if(t)return void Toast.error(t.msg||"Failed to rename template file");Toast.success("Template saved and renamed");const l=a.file.replace(/\.template\.html$/,"");return void setTimeout(()=>{window.location.href=`/admin/content/templates/edit?template=${encodeURIComponent(l)}`},1e3)}document.title=`Edit: ${template.name} - Admin`,Toast.success("Template saved")};render(){if(this.loading)return html`<div>Loading template...</div>`;if(this.error)return html`
      <div>
        <p>Template not found.</p>
        <a href="/admin/content/templates">Back to Templates</a>
      </div>
    `;const{template:e}=this,t="custom"===e.owner,a=e.locked;return html`
      ${a?html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This template is locked and cannot be edited. It is managed by an extension.
        </div>
      `:""}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/templates" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Templates
          </a>
        </div>
        <div class="flex"></div>
        ${t&&!a?html`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Template</button>
          </div>
        `:""}
        <div class="btn-grp mrh mb">
          <button @click="${this.handleCopy}"><k-icon name="content_copy"></k-icon> Copy Template</button>
        </div>
        ${a?"":html`
          <div class="btn-grp mrh mb">
            <button @click="${this.handleReset}"><k-icon name="restart_alt"></k-icon> Reset</button>
            <button id="saveBtn" class="primary" ?disabled="${this.saving}" @click="${this.handleSave}">
              <k-icon name="save"></k-icon> Save
            </button>
          </div>
        `}
      </div>

      <h1 class="mb">Template: ${e.name}</h1>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${e.name||""}" ?disabled="${!t||a}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Directory</strong></label>
              <span class="muted">${(()=>{const e=this.file.replace(/\.template\.html$/,"").split("/");return e.pop(),e.length?e.join("/"):"/"})()}</span>
              ${t&&!a?html`
                <button class="icon-btn no-btn ph" title="Move Template" @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon></button>
              `:""}
            </div>
            ${e.author?html`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${e.author}</span>
              </div>
            `:""}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Owner</strong></label>
              <span class="muted">${e.owner||""}</span>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Created</strong></label>
              <span class="muted">${e.createdAt?new Date(e.createdAt).toLocaleString():""}</span>
            </div>
            <div class="d-f" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Updated</strong></label>
              <span class="muted">${e.updatedAt?new Date(e.updatedAt).toLocaleString():""}</span>
            </div>
          </div>
        </k-accordion-panel>

        <k-accordion-header for-panel="template" active>Template</k-accordion-header>
        <k-accordion-panel name="template" active>
          <div class="p">
            <k-code-editor
              id="templateEditor"
              class="r b"
              language="html"
              .value="${e.markup||""}"
              style="height: 70vh; min-height: 400px;"
              ?disabled="${a}"
            ></k-code-editor>
          </div>
        </k-accordion-panel>
      </k-accordion>
    `}}customElements.define("admin-template-editor",TemplateEditor);
//# sourceMappingURL=TemplateEditor.js.map