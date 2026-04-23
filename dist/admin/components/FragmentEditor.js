import ShadowComponent from"/kempo-ui/components/ShadowComponent.js";import{html}from"/kempo-ui/lit-all.min.js";import{getFragment,updateFragment,deleteFragments,moveFragment,listDirectories}from"/kempo/sdk.js";import Dialog from"/kempo-ui/components/Dialog.js";import Toast from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Accordion.js";import"/kempo-ui/components/CodeEditor.js";export default class FragmentEditor extends ShadowComponent{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},fragment:{state:!0}};constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.fragment=null,this.file=""}async connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown);const e=new URLSearchParams(window.location.search).get("fragment");if(this.file=e?e+".fragment.html":"",!this.file)return this.loading=!1,void(this.error=!0);const[t,a]=await getFragment(this.file);this.loading=!1,t?this.error=!0:(this.fragment=a,document.title=`Edit: ${a.name} - Admin`)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}getFormState(){const e=this.shadowRoot;return{name:e.querySelector("#metaName")?.value??this.fragment.name,markup:e.querySelector("k-code-editor")?.getValue()??this.fragment.markup}}handleKeyDown=e=>{(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.saving||this.fragment?.locked||this.handleSave())};handleDelete=()=>{Dialog.confirm("Delete this fragment? This action cannot be undone.",async e=>{if(!e)return;const[t]=await deleteFragments([this.file]);t?Toast.error(t.msg||"Failed to delete fragment"):(Toast.success("Fragment deleted"),setTimeout(()=>{window.location.href="/admin/content/fragments"},1e3))})};handleMove=async()=>{const[,e]=await listDirectories(),t=e?.directories||["."],a=this.file.replace(/\.fragment\.html$/,"").split("/"),n=a.pop(),i=a.join("/")||".",r=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",s="."===i?"/":"/"+i,o=Dialog.create(html`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${s}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${t.map(e=>html`<option value="${"."===e?"/":"/"+e}">`)}
          </datalist>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Fragment Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${n}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `,{title:"Move Fragment",confirmText:"Save and Move Fragment",confirmAction:async()=>{const e=o.querySelector("#dlg-move-dir").value.trim()||"/",t=o.querySelector("#dlg-move-name").value.trim();if(!t)return void Toast.error("Fragment name is required");if(!/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(a=e)||a.includes("..")||a.includes("//"))return void Toast.error("Invalid directory path");var a;const n=r(e),i="."===n?`${t}.fragment.html`:`${n}/${t}.fragment.html`;this.saving=!0;const[s]=await updateFragment({file:this.file,markup:this.getFormState().markup});if(this.saving=!1,s)return void Toast.error(s.msg||"Failed to save fragment");const[l,m]=await moveFragment({file:this.file,newFile:i});if(l)return void Toast.error(l.msg||"Failed to move fragment");Toast.success("Fragment saved and moved");const d=m.file.replace(/\.fragment\.html$/,"");setTimeout(()=>{window.location.href=`/admin/content/fragments/edit?fragment=${encodeURIComponent(d)}`},1e3)},cancelText:"Cancel"}),l=()=>{const e=r(o.querySelector("#dlg-move-dir").value||"/"),t=o.querySelector("#dlg-move-name").value,a="."===e?"/":"/"+e+"/";o.querySelector("#dlg-move-preview").textContent=t?a+t:""};o.querySelector("#dlg-move-dir").addEventListener("input",l),o.querySelector("#dlg-move-name").addEventListener("input",l),l()};handleReset=()=>{Dialog.confirm("Reset this fragment? Any unsaved changes will be lost.",e=>{e&&(this.fragment={...this.fragment})})};handleSave=async()=>{this.saving=!0;const e=this.getFormState(),[t,a]=await updateFragment({file:this.file,markup:e.markup});if(this.saving=!1,t)return void Toast.error(t.msg||"Failed to save fragment");this.fragment={...this.fragment,markup:e.markup,updatedAt:a.updatedAt};const n=this.file.replace(/\.fragment\.html$/,"").split("/"),i=n.pop(),r=n.join("/"),s=e.name.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");if(s&&s!==i){const e=r?`${r}/${s}.fragment.html`:`${s}.fragment.html`,[t,a]=await moveFragment({file:this.file,newFile:e});if(t)return void Toast.error(t.msg||"Failed to rename fragment file");Toast.success("Fragment saved and renamed");const n=a.file.replace(/\.fragment\.html$/,"");return void setTimeout(()=>{window.location.href=`/admin/content/fragments/edit?fragment=${encodeURIComponent(n)}`},1e3)}document.title=`Edit: ${this.fragment.name} - Admin`,Toast.success("Fragment saved")};render(){if(this.loading)return html`<div>Loading fragment...</div>`;if(this.error)return html`
      <div>
        <p>Fragment not found.</p>
        <a href="/admin/content/fragments">Back to Fragments</a>
      </div>
    `;const{fragment:e}=this,t="custom"===e.owner,a=e.locked;return html`
      ${a?html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This fragment is locked and cannot be edited. It is managed by ${t?"an extension":"the system"}.
        </div>
      `:""}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/fragments" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Fragments
          </a>
        </div>
        <div class="flex"></div>
        ${t&&!a?html`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Fragment</button>
          </div>
        `:""}
        ${a?"":html`
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
              <input type="text" id="metaName" class="flex" .value="${e.name||""}" ?disabled="${!t||a}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Directory</strong></label>
              <span class="muted">${(()=>{const e=this.file.replace(/\.fragment\.html$/,"").split("/");return e.pop(),e.length?e.join("/"):"/"})()}</span>
              ${t&&!a?html`
                <button class="icon-btn no-btn ph" title="Move Fragment" @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon></button>
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
        <k-accordion-header for-panel="fragment" active>Fragment</k-accordion-header>
        <k-accordion-panel name="fragment" active>
          <div class="p">
            <k-code-editor
              class="r b"
              language="html"
              .value="${e.markup||""}"
              style="height: 500px;"
              ?disabled="${a}"
            ></k-code-editor>
          </div>
        </k-accordion-panel>
      </k-accordion>
    `}}customElements.define("admin-fragment-editor",FragmentEditor);
//# sourceMappingURL=FragmentEditor.js.map