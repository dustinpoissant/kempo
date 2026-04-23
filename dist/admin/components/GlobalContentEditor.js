import ShadowComponent from"/kempo-ui/components/ShadowComponent.js";import{html}from"/kempo-ui/lit-all.min.js";import{getGlobalContent,updateGlobalContent,deleteGlobalContent}from"/kempo/sdk.js";import Dialog from"/kempo-ui/components/Dialog.js";import Toast from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Accordion.js";import"/kempo-ui/components/CodeEditor.js";export default class GlobalContentEditor extends ShadowComponent{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},entry:{state:!0}};constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.entry=null,this.entryId=""}async connectedCallback(){if(super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown),this.entryId=new URLSearchParams(window.location.search).get("id")||"",!this.entryId)return this.loading=!1,void(this.error=!0);const[e,t]=await getGlobalContent(this.entryId);this.loading=!1,e?this.error=!0:(this.entry=t,document.title=`Edit: ${t.name||this.entryId} - Admin`)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}handleKeyDown=e=>{(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.saving||this.entry?.locked||this.handleSave())};handleSave=async()=>{this.saving=!0;const e=this.shadowRoot,t=e.querySelector("#metaName").value,n=e.querySelector("#metaLocation").value,a=e.querySelector("#metaPriority").value,o=e.querySelector("k-code-editor"),i=o?o.getValue():this.entry.markup,[s,l]=await updateGlobalContent({id:this.entryId,name:t,location:n,priority:a,markup:i});this.saving=!1,s?Toast.error(s.msg||"Failed to save global content"):(this.entry={...this.entry,name:t,location:n,priority:a,markup:i,updatedAt:l.updatedAt},document.title=`Edit: ${t||this.entryId} - Admin`,Toast.success("Global content saved"))};handleReset=()=>{Dialog.confirm("Reset this entry? Any unsaved changes will be lost.",e=>{e&&(this.entry={...this.entry})})};handleDelete=()=>{Dialog.confirm("Delete this global content entry? This action cannot be undone.",async e=>{if(!e)return;const[t]=await deleteGlobalContent([this.entryId]);t?Toast.error(t.msg||"Failed to delete global content"):(Toast.success("Global content deleted"),setTimeout(()=>{window.location.href="/admin/content/globals"},1e3))})};render(){if(this.loading)return html`<div>Loading global content...</div>`;if(this.error)return html`
      <div>
        <p>Global content entry not found.</p>
        <a href="/admin/content/globals">Back to Global Content</a>
      </div>
    `;const{entry:e}=this,t="system"===e.owner,n=e.locked;return html`
      ${n?html`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This entry is locked and cannot be edited. It is managed by ${t?"the system":"an extension"}.
        </div>
      `:""}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/globals" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Global Content
          </a>
        </div>
        <div class="flex"></div>
        ${t||n?"":html`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
          </div>
        `}
        ${n?"":html`
          <div class="btn-grp mrh mb">
            <button @click="${this.handleReset}"><k-icon name="restart_alt"></k-icon> Reset</button>
            <button id="saveBtn" class="primary" ?disabled="${this.saving}" @click="${this.handleSave}">
              <k-icon name="save"></k-icon> Save
            </button>
          </div>
        `}
      </div>
      <h1 class="mb">Global Content: ${e.name||this.entryId}</h1>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${e.name||""}" ?disabled="${t||n}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Location</strong></label>
              <input type="text" id="metaLocation" class="flex" .value="${e.location||""}" ?disabled="${t||n}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Priority</strong></label>
              <input type="number" id="metaPriority" class="flex" .value="${e.priority??0}" ?disabled="${t||n}">
            </div>
            ${t?"":html`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${e.author||""}</span>
              </div>
            `}
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
        <k-accordion-header for-panel="content" active>Content</k-accordion-header>
        <k-accordion-panel name="content" active>
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
    `}}customElements.define("admin-global-content-editor",GlobalContentEditor);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\GlobalContentEditor.js.map