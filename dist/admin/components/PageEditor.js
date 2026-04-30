import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,repeat as a}from"/kempo-ui/lit-all.min.js";import{getPage as n,updatePage as s,listTemplates as i,deletePages as l,listDirectories as o,movePage as r}from"/kempo/sdk.js";import c from"/kempo-ui/components/Dialog.js";import d from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Accordion.js";import"/kempo-ui/components/HtmlEditor.js";const m=new Set(["head","scripts"]),p=e=>e.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");export default class g extends e{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},page:{state:!0},templates:{state:!0},contents:{state:!0}};constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.page=null,this.templates=[],this.contents=[],this.file=""}async connectedCallback(){if(super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown),this.file=new URLSearchParams(window.location.search).get("path")+".page.html",!this.file||".page.html"===this.file)return this.loading=!1,void(this.error=!0);const[[e,t],[,a]]=await Promise.all([n(this.file),i()]);this.loading=!1,e?this.error=!0:(this.templates=a?.templates||[],this.page=t,this.contents=this.buildContents(t.template,t.contents),document.title=`Edit: ${t.name||t.title||this.file} - Admin`)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}getPageUrl(){return"/"+this.file.replace(/\.page\.html$/,"").split("/").filter(Boolean).join("/")}buildContents(e,t){const a=this.templates.find(t=>t.name===e),n=(a?.locations||[{name:"default",label:null}]).map(e=>"string"==typeof e?{name:e,label:null}:e),s=n.map(({name:e,label:a})=>{const n=t.find(t=>t.location===e);return{location:e,label:a||null,content:n?.content||"",orphaned:!1}});for(const e of t)n.some(t=>t.name===e.location)||s.push({location:e.location,label:null,content:e.content,orphaned:!0});return s}getFormState(){const e=this.shadowRoot,t=new Map([...e.querySelectorAll("k-html-editor[data-location]")].map(e=>[e.dataset.location,e.getValue()]));return{name:e.querySelector("#metaName").value,title:e.querySelector("#metaTitle").value,description:e.querySelector("#metaDescription").value,template:e.querySelector("#metaTemplate").value,contents:this.contents.map(({location:e,content:a,orphaned:n})=>({location:e,content:n?t.get(e)?.trim()||a:t.get(e)??a}))}}handleKeyDown=e=>{(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.saving||this.page?.locked||this.handleSave())};handleTemplateChange=e=>{if(this.page?.locked)return;const t=e.target.value,a=new Map([...this.shadowRoot.querySelectorAll("k-html-editor[data-location]")].map(e=>[e.dataset.location,e.getValue()])),n=this.contents.map(({location:e,content:t})=>({location:e,content:a.get(e)?.trim()||t}));this.contents=this.buildContents(t,n),this.page={...this.page,template:t}};handleDelete=()=>{c.confirm("Delete this page? This action cannot be undone.",async e=>{if(!e)return;const[t]=await l([this.file]);t?d.error(t.msg||"Failed to delete page"):(d.success("Page deleted"),setTimeout(()=>{window.location.href="/admin/pages"},1e3))})};handleMove=async()=>{const[,e]=await o(),a=e?.directories||["."],n=this.file.replace(/\.page\.html$/,"").split("/"),i=n.pop(),l=n.join("/")||".",m=e=>/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(e)&&!e.includes("..")&&!e.includes("//"),g=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",h="."===l?"/":"/"+l,u=c.create(t`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${h}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${a.map(e=>t`<option value="${"."===e?"/":"/"+e}">`)} 
          </datalist>
          <p id="dlg-move-dir-error" class="mt-sm tc-danger d-n"><small>Invalid path — use format: /path/to/directory</small></p>
          <p class="mt-sm muted"><small>Supports dynamic segments e.g. <code>/blog/[slug]</code>. <button class="link" @click="${()=>c.alert(t`
      <div class="p">
        <p>Directory paths define where a page lives in the URL structure.</p>
        <p><strong>Examples:</strong></p>
        <ul>
          <li><code>/</code> — root, e.g. <code>/about</code></li>
          <li><code>/blog</code> — e.g. <code>/blog/my-post</code></li>
          <li><code>/blog/[slug]</code> — dynamic segment; <code>[slug]</code> matches any value</li>
        </ul>
        <p>Dynamic segments like <code>[token]</code> allow a single page to handle many URLs. The segment name is available to the page as a URL parameter.</p>
        <p>You can nest segments: <code>/store/[category]/[id]</code></p>
      </div>
    `,null,{title:"About Directory Paths"})}">Learn more</button></small></p>
        </div>
        <div>
          <label class="d-b mb-sm"><strong>Page Name</strong></label>
          <input type="text" id="dlg-move-name" class="full" .value="${i}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `,{title:"Move Page",confirmText:"Save and Move Page",confirmAction:async()=>{const e=u.querySelector("#dlg-move-dir").value.trim()||"/",t=p(u.querySelector("#dlg-move-name").value.trim());if(!t)return void d.error("Page name is required");if(!m(e))return void d.error("Invalid directory path");const a=g(e),n="."===a?`${t}.page.html`:`${a}/${t}.page.html`;this.saving=!0;const[i]=await s({file:this.file,...this.getFormState()});if(this.saving=!1,i)return void d.error(i.msg||"Failed to save page");const[l,o]=await r({file:this.file,newFile:n});l?d.error(l.msg||"Failed to move page"):(d.success("Page saved and moved"),setTimeout(()=>{window.location.href=`/admin/pages/edit?path=${encodeURIComponent(o.file.replace(/\.page\.html$/,""))}`},1e3))},cancelText:"Cancel"}),v=()=>{const e=g(u.querySelector("#dlg-move-dir").value||"/"),t=p(u.querySelector("#dlg-move-name").value),a="."===e?"/":"/"+e+"/";u.querySelector("#dlg-move-preview").textContent=t?a+t:""};u.querySelector("#dlg-move-dir").addEventListener("input",e=>{u.querySelector("#dlg-move-dir-error").classList.toggle("d-n",m(e.target.value||"/")),v()}),u.querySelector("#dlg-move-name").addEventListener("input",v),v()};handleReset=()=>{c.confirm("Reset this page? Any unsaved changes will be lost.",e=>{e&&(this.contents=this.buildContents(this.page.template,this.page.contents),this.page={...this.page})})};handleSave=async()=>{this.saving=!0;const e=this.getFormState(),[t,a]=await s({file:this.file,...e});this.saving=!1,t?d.error(t.msg||"Failed to save page"):(this.contents=this.contents.map(t=>{const a=e.contents.find(e=>e.location===t.location);return a?{...t,content:a.content}:t}),this.page={...this.page,...e,contents:e.contents.filter(e=>e.content.trim()),updatedAt:a.updatedAt},document.title=`Edit: ${e.name||e.title||this.file} - Admin`,d.success("Page saved"))};render(){if(this.loading)return t`<div>Loading page...</div>`;if(this.error)return t`
      <div>
        <p>Page not found.</p>
        <a href="/admin/pages">Back to Pages</a>
      </div>
    `;const{page:e,templates:n,contents:s}=this,i="system"===e.owner,l=e.locked;return t`
      ${l?t`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This page is locked and cannot be edited. ${"custom"===e.owner?"Locked by developer":`Managed by: ${e.owner||"external system"}`}
        </div>
      `:""}
      <div class="d-f mb">
        <div class="btn-grp mrh mb">
          <a href="/admin/content/pages" class="btn">
            <k-icon name="arrow" direction="left"></k-icon> Pages
          </a>
          <a href="${this.getPageUrl()}" id="page-link" class="btn">
            <k-icon name="visibility"></k-icon> View Page
          </a>
        </div>
        
        <div class="flex"></div>
        ${i||l?"":t`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Page</button>
          </div>
        `}
        ${l?"":t`
          <div class="btn-grp mrh mb">
            <button @click="${this.handleReset}"><k-icon name="restart_alt"></k-icon> Reset</button>
            <button id="saveBtn" class="primary" ?disabled="${this.saving}" @click="${this.handleSave}">
              <k-icon name="save"></k-icon> Save
            </button>
          </div>
        `}
      </div>
      <h1 class="mb0">Page: ${e.name||e.title||this.file}</h1>

      <a href="${this.getPageUrl()}" class="d-b mb"><code>${this.getPageUrl()}</code></a>

      <k-accordion>
        <k-accordion-header for-panel="metadata">Metadata</k-accordion-header>
        <k-accordion-panel name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${e.name||""}" ?disabled="${i||l}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Title</strong></label>
              <input type="text" id="metaTitle" class="flex" .value="${e.title||""}" ?disabled="${l}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Description</strong></label>
              <input type="text" id="metaDescription" class="flex" .value="${e.description||""}" ?disabled="${i||l}">
            </div>
            ${i?"":t`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${e.author||""}</span>
              </div>
            `}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Template</strong></label>
              ${(()=>{const a=this.file.replace(/\.page\.html$/,"").split("/").slice(0,-1).join("/")||".",s=n.filter(e=>{const t="."===e.directory?"":e.directory,n="."===a?"":a;return""===t||n===t||n.startsWith(t+"/")}),i=s.some(t=>t.name===e.template);return t`
                  <select id="metaTemplate" class="flex" @change="${this.handleTemplateChange}" ?disabled="${l}">
                    ${i?"":t`<option value="${e.template}" selected>${e.template} (Not Found, using default)</option>`}
                    ${s.map(a=>t`
                      <option value="${a.name}" ?selected="${a.name===e.template}">${(e=>"."===e.directory?`/${e.name}`:`/${e.directory}/${e.name}`)(a)}</option>
                    `)}
                  </select>
                `})()}
            </div>
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
        ${Object.keys(e.extraMetadata||{}).length?t`
          <k-accordion-header for-panel="extra-metadata">Extra Metadata</k-accordion-header>
          <k-accordion-panel name="extra-metadata">
            <div class="p">
              ${Object.entries(e.extraMetadata).map(([e,a])=>t`
                <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                  <label style="min-width: 120px;" class="muted"><strong>${e}</strong></label>
                  <span>${a}</span>
                </div>
              `)}
              <p class="muted mt0"><small>Extra metadata is managed by extensions and cannot be edited here.</small></p>
            </div>
          </k-accordion-panel>
        `:""}
        ${a(s,e=>e.location,({location:e,label:a,content:n,orphaned:s})=>{const i="default"===e,o=a||(i?"Content":e.slice(0,1).toUpperCase()+e.slice(1));return t`
            <k-accordion-header for-panel="content-${e}" ?active="${i}">
              ${o}${s?t` <span class="tc-warning"><small>(not in template)</small></span>`:""}
            </k-accordion-header>
            <k-accordion-panel name="content-${e}" ?active="${i}">
              <div class="p">
                <k-html-editor
                  class="r b"
                  data-location="${e}"
                  controls="full"
                  .value="${n}"
                  mode="${m.has(e)?"code":"visual"}"
                  style="height: 400px;"
                  ?disabled="${l}"
                ></k-html-editor>
              </div>
            </k-accordion-panel>
          `})}
      </k-accordion>
    `}}customElements.define("admin-page-editor",g);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\PageEditor.js.map