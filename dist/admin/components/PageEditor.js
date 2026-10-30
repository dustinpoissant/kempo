import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,repeat as a,staticHtml as n,unsafeStatic as s}from"/kempo-ui/lit-all.min.js";import{getPage as l,updatePage as i,listTemplates as o,deletePages as r,listDirectories as c,movePage as d}from"/kempo/sdk.js";import m from"/kempo-ui/components/Dialog.js";import p from"/kempo-ui/components/Toast.js";import{getComponentOverride as g,getEditorExtensions as h}from"../component-overrides.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Tabs.js";import"/kempo-ui/components/HtmlEditor.js";const u=new Set(["head","scripts"]),v=e=>e.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");export default class b extends e{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},page:{state:!0},templates:{state:!0},contents:{state:!0}};constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.page=null,this.templates=[],this.contents=[],this.file=""}async connectedCallback(){if(super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown),this.file=new URLSearchParams(window.location.search).get("path")+".page.html",!this.file||".page.html"===this.file)return this.loading=!1,void(this.error=!0);const[[e,t],[,a]]=await Promise.all([l(this.file),o()]);this.loading=!1,e?this.error=!0:(this.templates=a?.templates||[],this.page=t,this.contents=this.buildContents(t.template,t.contents),document.title=`Edit: ${t.name||t.title||this.file} - Admin`)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}getPageUrl(){return"/"+this.file.replace(/\.page\.html$/,"").split("/").filter(Boolean).join("/")}buildContents(e,t){const a=this.templates.find(t=>t.name===e),n=(a?.locations||[{name:"default",label:null}]).map(e=>"string"==typeof e?{name:e,label:null}:e),s=n.map(({name:e,label:a})=>{const n=t.find(t=>t.location===e);return{location:e,label:a||null,content:n?.content||"",orphaned:!1}});for(const e of t)n.some(t=>t.name===e.location)||s.push({location:e.location,label:null,content:e.content,orphaned:!0});return s}getFormState(){const e=this.shadowRoot,t=new Map([...e.querySelectorAll("[data-location]")].map(e=>[e.dataset.location,e.getValue()]));return{name:e.querySelector("#metaName").value,title:e.querySelector("#metaTitle").value,description:e.querySelector("#metaDescription").value,template:e.querySelector("#metaTemplate").value,contents:this.contents.map(({location:e,content:a,orphaned:n})=>({location:e,content:n?t.get(e)?.trim()||a:t.get(e)??a}))}}handleKeyDown=e=>{(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.saving||this.page?.locked||this.handleSave())};handleTemplateChange=e=>{if(this.page?.locked)return;const t=e.target.value,a=new Map([...this.shadowRoot.querySelectorAll("[data-location]")].map(e=>[e.dataset.location,e.getValue()])),n=this.contents.map(({location:e,content:t})=>({location:e,content:a.get(e)?.trim()||t}));this.contents=this.buildContents(t,n),this.page={...this.page,template:t}};handleDelete=()=>{m.confirm("Delete this page? This action cannot be undone.",async e=>{if(!e)return;const[t]=await r([this.file]);t?p.error(t.msg||"Failed to delete page"):(p.success("Page deleted"),setTimeout(()=>{window.location.href="/admin/pages"},1e3))})};handleMove=async()=>{const[,e]=await c(),a=e?.directories||["."],n=this.file.replace(/\.page\.html$/,"").split("/"),s=n.pop(),l=n.join("/")||".",o=e=>/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(e)&&!e.includes("..")&&!e.includes("//"),r=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",g="."===l?"/":"/"+l,h=m.create(t`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${g}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${a.map(e=>t`<option value="${"."===e?"/":"/"+e}">`)} 
          </datalist>
          <p id="dlg-move-dir-error" class="mt-sm tc-danger d-n"><small>Invalid path — use format: /path/to/directory</small></p>
          <p class="mt-sm muted"><small>Supports dynamic segments e.g. <code>/blog/[slug]</code>. <button class="link" @click="${()=>m.alert(t`
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
          <input type="text" id="dlg-move-name" class="full" .value="${s}">
          <p class="mt-sm muted"><small id="dlg-move-preview"></small></p>
        </div>
      </div>
    `,{title:"Move Page",confirmText:"Save and Move Page",confirmAction:async()=>{const e=h.querySelector("#dlg-move-dir").value.trim()||"/",t=v(h.querySelector("#dlg-move-name").value.trim());if(!t)return void p.error("Page name is required");if(!o(e))return void p.error("Invalid directory path");const a=r(e),n="."===a?`${t}.page.html`:`${a}/${t}.page.html`;this.saving=!0;const[s]=await i({file:this.file,...this.getFormState()});if(this.saving=!1,s)return void p.error(s.msg||"Failed to save page");const[l,c]=await d({file:this.file,newFile:n});l?p.error(l.msg||"Failed to move page"):(p.success("Page saved and moved"),setTimeout(()=>{window.location.href=`/admin/content/pages/edit?path=${encodeURIComponent(c.file.replace(/\.page\.html$/,""))}`},1e3))},cancelText:"Cancel"}),u=()=>{const e=r(h.querySelector("#dlg-move-dir").value||"/"),t=v(h.querySelector("#dlg-move-name").value),a="."===e?"/":"/"+e+"/";h.querySelector("#dlg-move-preview").textContent=t?a+t:""};h.querySelector("#dlg-move-dir").addEventListener("input",e=>{h.querySelector("#dlg-move-dir-error").classList.toggle("d-n",o(e.target.value||"/")),u()}),h.querySelector("#dlg-move-name").addEventListener("input",u),u()};handleReset=()=>{m.confirm("Reset this page? Any unsaved changes will be lost.",e=>{e&&(this.contents=this.buildContents(this.page.template,this.page.contents),this.page={...this.page})})};handleSave=async()=>{this.saving=!0;const e=this.getFormState(),[t,a]=await i({file:this.file,...e});this.saving=!1,t?p.error(t.msg||"Failed to save page"):(this.contents=this.contents.map(t=>{const a=e.contents.find(e=>e.location===t.location);return a?{...t,content:a.content}:t}),this.page={...this.page,...e,contents:e.contents.filter(e=>e.content.trim()),updatedAt:a.updatedAt},document.title=`Edit: ${e.name||e.title||this.file} - Admin`,p.success("Page saved"))};render(){if(this.loading)return t`<div>Loading page...</div>`;const e=this.contents.some(e=>"default"===e.location)?"content-default":"metadata";if(this.error)return t`
      <div>
        <p>Page not found.</p>
        <a href="/admin/pages">Back to Pages</a>
      </div>
    `;const{page:l,templates:i,contents:o}=this,r="system"===l.owner,c=l.locked;return t`
      ${c?t`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This page is locked and cannot be edited. ${"custom"===l.owner?"Locked by developer":`Managed by: ${l.owner||"external system"}`}
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
        ${r||c?"":t`
          <div class="btn-grp mrh mb">
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Page</button>
          </div>
        `}
        ${c?"":t`
          <div class="btn-grp mrh mb">
            <button @click="${this.handleReset}"><k-icon name="restart_alt"></k-icon> Reset</button>
            <button id="saveBtn" class="primary" ?disabled="${this.saving}" @click="${this.handleSave}">
              <k-icon name="save"></k-icon> Save
            </button>
          </div>
        `}
      </div>
      <h1 class="mb0">Page: ${l.name||l.title||this.file}</h1>

      <a href="${this.getPageUrl()}" class="d-b mb"><code>${this.getPageUrl()}</code></a>

      <k-tabs active="${e}">
        <k-tab for="metadata">Metadata</k-tab>
        <k-tab-content name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${l.name||""}" ?disabled="${r||c}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Title</strong></label>
              <input type="text" id="metaTitle" class="flex" .value="${l.title||""}" ?disabled="${c}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Description</strong></label>
              <input type="text" id="metaDescription" class="flex" .value="${l.description||""}" ?disabled="${r||c}">
            </div>
            ${r?"":t`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${l.author||""}</span>
              </div>
            `}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Template</strong></label>
              ${(()=>{const e=this.file.replace(/\.page\.html$/,"").split("/").slice(0,-1).join("/")||".",a=i.filter(t=>{const a="."===t.directory?"":t.directory,n="."===e?"":e;return""===a||n===a||n.startsWith(a+"/")}),n=a.some(e=>e.name===l.template);return t`
                  <select id="metaTemplate" class="flex" @change="${this.handleTemplateChange}" ?disabled="${c}">
                    ${n?"":t`<option value="${l.template}" selected>${l.template} (Not Found, using default)</option>`}
                    ${a.map(e=>t`
                      <option value="${e.name}" ?selected="${e.name===l.template}">${(e=>"."===e.directory?`/${e.name}`:`/${e.directory}/${e.name}`)(e)}</option>
                    `)}
                  </select>
                `})()}
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Owner</strong></label>
              <span class="muted">${l.owner||""}</span>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Created</strong></label>
              <span class="muted">${l.createdAt?new Date(l.createdAt).toLocaleString():""}</span>
            </div>
            <div class="d-f" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Updated</strong></label>
              <span class="muted">${l.updatedAt?new Date(l.updatedAt).toLocaleString():""}</span>
            </div>
          </div>
        </k-tab-content>
        ${Object.keys(l.extraMetadata||{}).length?t`
          <k-tab for="extra-metadata">Extra Metadata</k-tab>
          <k-tab-content name="extra-metadata">
            <div class="p">
              ${Object.entries(l.extraMetadata).map(([e,a])=>t`
                <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                  <label style="min-width: 120px;" class="muted"><strong>${e}</strong></label>
                  <span>${a}</span>
                </div>
              `)}
              <p class="muted mt0"><small>Extra metadata is managed by extensions and cannot be edited here.</small></p>
            </div>
          </k-tab-content>
        `:""}
        ${a(o,e=>e.location,({location:e,label:a,content:l,orphaned:i})=>{const o=a||("default"===e?"Content":e.slice(0,1).toUpperCase()+e.slice(1)),r=s(g("page-content-editor","k-html-editor")),d=u.has(e)?{nodes:[],controls:[]}:h();return t`
            <k-tab for="content-${e}">
              ${o}${i?t` <span class="tc-warning"><small>(not in template)</small></span>`:""}
            </k-tab>
            <k-tab-content name="content-${e}">
              <div class="p">
                ${n`<${r}
                  class="r b"
                  data-location="${e}"
                  controls="full"
                  .value="${l}"
                  mode="${u.has(e)?"code":"visual"}"
                  nodes="${d.nodes.join(",")}"
                  ?disabled="${c}"
                >${d.controls.map(e=>n`<${s(e)} slot="toolbar-top-extra"></${s(e)}>`)}</${r}>`}
              </div>
            </k-tab-content>
          `})}
      </k-tabs>
    `}}customElements.define("admin-page-editor",b);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\PageEditor.js.map