import e from"/kempo-ui/components/ShadowComponent.js";import{html as t}from"/kempo-ui/lit-all.min.js";import{getTemplate as a,updateTemplate as i,deleteTemplates as l,moveTemplate as n,createTemplate as o,listDirectories as s}from"/kempo/sdk.js";import r from"/kempo-ui/components/Dialog.js";import d from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Accordion.js";import"/kempo-ui/components/CodeEditor.js";export default class c extends e{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},template:{state:!0}};constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.template=null,this.file=""}async connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown);const e=new URLSearchParams(window.location.search).get("template");if(this.file=e+".template.html",!this.file||".template.html"===this.file)return this.loading=!1,void(this.error=!0);const[t,i]=await a(this.file);this.loading=!1,t?this.error=!0:(this.template=i,document.title=`Edit: ${i.name} - Admin`)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}getFormState(){const e=this.shadowRoot;return{name:e.querySelector("#metaName")?.value??this.template.name,markup:e.querySelector("#templateEditor")?.getValue()??this.template.markup}}handleKeyDown=e=>{(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.saving||this.template?.locked||this.handleSave())};handleDelete=()=>{r.confirm("Delete this template? This action cannot be undone.",async e=>{if(!e)return;const[t]=await l([this.file]);t?d.error(t.msg||"Failed to delete template"):(d.success("Template deleted"),setTimeout(()=>{window.location.href="/admin/content/templates"},1e3))})};handleMove=async()=>{const[,e]=await s(),a=e?.directories||["."],l=this.file.replace(/\.template\.html$/,"").split("/"),o=l.pop(),c=l.join("/")||".",m=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",p="."===c?"/":"/"+c,v=r.create(t`
      <div class="p">
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="warning"></k-icon>
          <strong>Warning:</strong> Moving a template may break pages that reference it by name.<br />Pages search for templates by name starting from their own directory up to the root.<br />Moving this template could cause those pages to fall back to the <code>default</code> template.
        </div>
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${p}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${a.map(e=>t`<option value="${"."===e?"/":"/"+e}">`)} 
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Template Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${o}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `,{title:"Move Template",confirmText:"Save and Move Template",confirmAction:async()=>{const e=v.querySelector("#dlg-move-dir").value.trim()||"/",t=v.querySelector("#dlg-move-name").value.trim();if(!t)return void d.error("Template name is required");if(!/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(a=e)||a.includes("..")||a.includes("//"))return void d.error("Invalid directory path");var a;const l=m(e),o="."===l?`${t}.template.html`:`${l}/${t}.template.html`;this.saving=!0;const[s]=await i({file:this.file,...this.getFormState()});if(this.saving=!1,s)return void d.error(s.msg||"Failed to save template");const[r,c]=await n({file:this.file,newFile:o});if(r)return void d.error(r.msg||"Failed to move template");d.success("Template saved and moved");const p=c.file.replace(/\.template\.html$/,"");setTimeout(()=>{window.location.href=`/admin/content/templates/edit?template=${encodeURIComponent(p)}`},1e3)},cancelText:"Cancel"}),u=()=>{const e=m(v.querySelector("#dlg-move-dir").value||"/"),t=v.querySelector("#dlg-move-name").value,a="."===e?"/":"/"+e+"/";v.querySelector("#dlg-move-preview").textContent=t?a+t:""};v.querySelector("#dlg-move-dir").addEventListener("input",u),v.querySelector("#dlg-move-name").addEventListener("input",u),u()};handleCopy=async()=>{const[,e]=await s(),a=e?.directories||["."],i=this.file.replace(/\.template\.html$/,"").split("/"),l=i.pop(),n=i.join("/")||".",c=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",m="."===n?"/":"/"+n,p=r.create(t`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-copy-dir" class="full" list="dlg-copy-dir-list" .value="${m}" placeholder="/">
          <datalist id="dlg-copy-dir-list">
            ${a.map(e=>t`<option value="${"."===e?"/":"/"+e}">`)} 
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Template Name</strong></label>
          <input type="text" id="dlg-copy-name" class="full" .value="${l}-copy">
          <p class="mt-sm muted"><small id="dlg-copy-preview"></small></p>
        </div>
      </div>
    `,{title:"Copy Template",confirmText:"Copy Template",confirmAction:async()=>{const e=p.querySelector("#dlg-copy-dir").value.trim()||"/",t=p.querySelector("#dlg-copy-name").value.trim();if(!t)return void d.error("Template name is required");if(!/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(a=e)||a.includes("..")||a.includes("//"))return void d.error("Invalid directory path");var a;const i=c(e),[l,n]=await o({directory:"."===i?"":i,name:t,copyFrom:this.file});l?d.error(l.msg||"Failed to copy template"):(d.success("Template copied"),setTimeout(()=>{window.location.href=`/admin/content/templates/edit?template=${encodeURIComponent(n.file.replace(/\.template\.html$/,""))}`},1e3))},cancelText:"Cancel"}),v=()=>{const e=c(p.querySelector("#dlg-copy-dir").value||"/"),t=p.querySelector("#dlg-copy-name").value,a="."===e?"/":"/"+e+"/";p.querySelector("#dlg-copy-preview").textContent=t?a+t:""};p.querySelector("#dlg-copy-dir").addEventListener("input",v),p.querySelector("#dlg-copy-name").addEventListener("input",v),v()};handleReset=()=>{r.confirm("Reset this template? Any unsaved changes will be lost.",e=>{e&&(this.template={...this.template})})};handleSave=async()=>{this.saving=!0;const e=this.getFormState(),[t,a]=await i({file:this.file,markup:e.markup});if(this.saving=!1,t)return void d.error(t.msg||"Failed to save template");this.template={...this.template,markup:e.markup,updatedAt:a.updatedAt};const l=this.file.replace(/\.template\.html$/,"").split("/"),o=l.pop(),s=l.join("/"),r=e.name.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");if(r&&r!==o){const e=s?`${s}/${r}.template.html`:`${r}.template.html`,[t,a]=await n({file:this.file,newFile:e});if(t)return void d.error(t.msg||"Failed to rename template file");d.success("Template saved and renamed");const i=a.file.replace(/\.template\.html$/,"");return void setTimeout(()=>{window.location.href=`/admin/content/templates/edit?template=${encodeURIComponent(i)}`},1e3)}document.title=`Edit: ${template.name} - Admin`,d.success("Template saved")};render(){if(this.loading)return t`<div>Loading template...</div>`;if(this.error)return t`
      <div>
        <p>Template not found.</p>
        <a href="/admin/content/templates">Back to Templates</a>
      </div>
    `;const{template:e}=this,a="custom"===e.owner,i=e.locked;return t`
      ${i?t`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This template is locked and cannot be edited. ${"custom"===e.owner?"Locked by developer":`Managed by: ${e.owner||"external system"}`}
        </div>
      `:""}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/templates" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Templates
          </a>
        </div>
        <div class="flex"></div>
        ${a&&!i?t`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Template</button>
          </div>
        `:""}
        <div class="btn-grp mrh mb">
          <button @click="${this.handleCopy}"><k-icon name="content_copy"></k-icon> Copy Template</button>
        </div>
        ${i?"":t`
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
              <input type="text" id="metaName" class="flex" .value="${e.name||""}" ?disabled="${!a||i}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Directory</strong></label>
              <span class="muted">${(()=>{const e=this.file.replace(/\.template\.html$/,"").split("/");return e.pop(),e.length?e.join("/"):"/"})()}</span>
              ${a&&!i?t`
                <button class="icon-btn no-btn ph" title="Move Template" @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon></button>
              `:""}
            </div>
            ${e.author?t`
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
              ?disabled="${i}"
            ></k-code-editor>
          </div>
        </k-accordion-panel>
      </k-accordion>
    `}}customElements.define("admin-template-editor",c);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\TemplateEditor.js.map