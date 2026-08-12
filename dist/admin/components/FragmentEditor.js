import e from"/kempo-ui/components/ShadowComponent.js";import{html as t}from"/kempo-ui/lit-all.min.js";import{getFragment as a,updateFragment as n,deleteFragments as i,moveFragment as r,listDirectories as s}from"/kempo/sdk.js";import o from"/kempo-ui/components/Dialog.js";import l from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Accordion.js";import"/kempo-ui/components/CodeEditor.js";export default class d extends e{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},fragment:{state:!0}};constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.fragment=null,this.file=""}async connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown);const e=new URLSearchParams(window.location.search).get("fragment");if(this.file=e?e+".fragment.html":"",!this.file)return this.loading=!1,void(this.error=!0);const[t,n]=await a(this.file);this.loading=!1,t?this.error=!0:(this.fragment=n,document.title=`Edit: ${n.name} - Admin`)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}getFormState(){const e=this.shadowRoot;return{name:e.querySelector("#metaName")?.value??this.fragment.name,markup:e.querySelector("k-code-editor")?.getValue()??this.fragment.markup}}handleKeyDown=e=>{(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.saving||this.fragment?.locked||this.handleSave())};handleDelete=()=>{o.confirm("Delete this fragment? This action cannot be undone.",async e=>{if(!e)return;const[t]=await i([this.file]);t?l.error(t.msg||"Failed to delete fragment"):(l.success("Fragment deleted"),setTimeout(()=>{window.location.href="/admin/content/fragments"},1e3))})};handleMove=async()=>{const[,e]=await s(),a=e?.directories||["."],i=this.file.replace(/\.fragment\.html$/,"").split("/"),d=i.pop(),m=i.join("/")||".",c=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",g="."===m?"/":"/"+m,p=o.create(t`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${g}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${a.map(e=>t`<option value="${"."===e?"/":"/"+e}">`)}
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Fragment Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${d}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `,{title:"Move Fragment",confirmText:"Save and Move Fragment",confirmAction:async()=>{const e=p.querySelector("#dlg-move-dir").value.trim()||"/",t=p.querySelector("#dlg-move-name").value.trim();if(!t)return void l.error("Fragment name is required");if(!/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(a=e)||a.includes("..")||a.includes("//"))return void l.error("Invalid directory path");var a;const i=c(e),s="."===i?`${t}.fragment.html`:`${i}/${t}.fragment.html`;this.saving=!0;const[o]=await n({file:this.file,markup:this.getFormState().markup});if(this.saving=!1,o)return void l.error(o.msg||"Failed to save fragment");const[d,m]=await r({file:this.file,newFile:s});if(d)return void l.error(d.msg||"Failed to move fragment");l.success("Fragment saved and moved");const g=m.file.replace(/\.fragment\.html$/,"");setTimeout(()=>{window.location.href=`/admin/content/fragments/edit?fragment=${encodeURIComponent(g)}`},1e3)},cancelText:"Cancel"}),v=()=>{const e=c(p.querySelector("#dlg-move-dir").value||"/"),t=p.querySelector("#dlg-move-name").value,a="."===e?"/":"/"+e+"/";p.querySelector("#dlg-move-preview").textContent=t?a+t:""};p.querySelector("#dlg-move-dir").addEventListener("input",v),p.querySelector("#dlg-move-name").addEventListener("input",v),v()};handleReset=()=>{o.confirm("Reset this fragment? Any unsaved changes will be lost.",e=>{e&&(this.fragment={...this.fragment})})};handleSave=async()=>{this.saving=!0;const e=this.getFormState(),[t,a]=await n({file:this.file,markup:e.markup});if(this.saving=!1,t)return void l.error(t.msg||"Failed to save fragment");this.fragment={...this.fragment,markup:e.markup,updatedAt:a.updatedAt};const i=this.file.replace(/\.fragment\.html$/,"").split("/"),s=i.pop(),o=i.join("/"),d=e.name.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");if(d&&d!==s){const e=o?`${o}/${d}.fragment.html`:`${d}.fragment.html`,[t,a]=await r({file:this.file,newFile:e});if(t)return void l.error(t.msg||"Failed to rename fragment file");l.success("Fragment saved and renamed");const n=a.file.replace(/\.fragment\.html$/,"");return void setTimeout(()=>{window.location.href=`/admin/content/fragments/edit?fragment=${encodeURIComponent(n)}`},1e3)}document.title=`Edit: ${this.fragment.name} - Admin`,l.success("Fragment saved")};render(){if(this.loading)return t`<div>Loading fragment...</div>`;if(this.error)return t`
      <div>
        <p>Fragment not found.</p>
        <a href="/admin/content/fragments">Back to Fragments</a>
      </div>
    `;const{fragment:e}=this,a="custom"===e.owner,n=e.locked;return t`
      ${n?t`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This fragment is locked and cannot be edited. ${"custom"===e.owner?"Locked by developer":`Managed by: ${e.owner||"external system"}`}
        </div>
      `:""}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/fragments" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Fragments
          </a>
        </div>
        <div class="flex"></div>
        ${a&&!n?t`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Fragment</button>
          </div>
        `:""}
        ${n?"":t`
          <div class="btn-grp mrh mb">
            <button @click="${this.handleReset}"><k-icon name="restart_alt"></k-icon> Reset</button>
            <button id="saveBtn" class="primary" ?disabled="${this.saving}" @click="${this.handleSave}">
              <k-icon name="save"></k-icon> Save
            </button>
          </div>
        `}
      </div>

      <h1 class="mb">Fragment: ${e.name}</h1>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${e.name||""}" ?disabled="${!a||n}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Directory</strong></label>
              <span class="muted">${(()=>{const e=this.file.replace(/\.fragment\.html$/,"").split("/");return e.pop(),e.length?e.join("/"):"/"})()}</span>
              ${a&&!n?t`
                <button class="icon-btn no-btn ph" title="Move Fragment" @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon></button>
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
        <k-accordion-header for-panel="fragment" active>Fragment</k-accordion-header>
        <k-accordion-panel name="fragment" active>
          <div class="p">
            <k-code-editor
              class="r b"
              language="html"
              .value="${e.markup||""}"
              style="height: 500px;"
              ?disabled="${n}"
            ></k-code-editor>
          </div>
        </k-accordion-panel>
      </k-accordion>
    `}}customElements.define("admin-fragment-editor",d);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\FragmentEditor.js.map