import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,css as a,repeat as i,staticHtml as s,unsafeStatic as l}from"/kempo-ui/lit-all.min.js";import{getPage as n,updatePage as o,listTemplates as r,deletePages as c,listDirectories as d,movePage as p,copyPage as m,listPages as h,openSitebuilderPage as g,saveSitebuilderPage as u,resolveSitebuilderConflict as b,leaveSitebuilderCodeMode as v}from"/kempo/sdk.js";import f from"/kempo-ui/components/Dialog.js";import y from"/kempo-ui/components/Toast.js";import{getComponentOverride as $,getEditorExtensions as w}from"../component-overrides.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Tabs.js";import"/kempo-ui/components/HtmlEditor.js";import"/kempo-ui/components/CodeEditor.js";import"/kempo-ui/components/Dropdown.js";import"./pagebuilder/PageBuilderEditor.js";const k=new Set(["head"]),T=e=>e.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""),x=e=>`${String(e).trim().replace(/^\//,"").replace(/\/$/,"").replace(/\.page\.html$/,"")}.page.html`,C=e=>`<!DOCTYPE html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/kempo-css/kempo.min.css"><link rel="stylesheet" href="/styles.css"><script src="/init.js"><\/script><script type="module" src="/kempo-ui/utils/theme.js"><\/script></head><body><main class="p">${e}</main></body></html>`;export default class S extends e{static properties={loading:{state:!0},error:{state:!0},saving:{state:!0},page:{state:!0},templates:{state:!0},contents:{state:!0},builder:{state:!0},meta:{state:!0}};static styles=a`
    :host([builder]) {
      position: fixed;
      top: 0;
      bottom: 0;
      left: var(--left-panel-width, 0px);
      right: var(--right-panel-width, 0px);
      z-index: 1;
      display: block;
      background: var(--c_bg, #fff);
      transition: left var(--animation_ms, 256ms), right var(--animation_ms, 256ms);
    }
    admin-page-builder { display: block; height: 100%; }
  `;constructor(){super(),this.loading=!0,this.error=!1,this.saving=!1,this.page=null,this.templates=[],this.contents=[],this.builder=null,this.meta=null,this.metaDirty=!1,this.codeDirty=!1,this.file=""}updated(e){super.updated(e),this.toggleAttribute("builder",!this.loading&&this.inBuilder)}get extrasDirty(){return this.metaDirty||this.codeDirty}async connectedCallback(){if(super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown),this.file=new URLSearchParams(window.location.search).get("path")+".page.html",!this.file||".page.html"===this.file)return this.loading=!1,void(this.error=!0);await this.load()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown)}async load(){this.loading=!0;const[[e,t],[,a]]=await Promise.all([n(this.file),r()]);if(e)return this.loading=!1,void(this.error=!0);this.templates=a?.templates||[],this.page=t,this.contents=this.buildContents(t.template,t.contents),this.meta={name:t.name||"",title:t.title||"",description:t.description||"",template:t.template},this.metaDirty=!1,this.codeDirty=!1,await this.openBuilder(),this.loading=!1,document.title=`Edit: ${t.name||t.title||this.file} - Admin`,"conflict"===this.builder?.state&&this.showConflict()}async openBuilder(){const[e,t]=await g(this.file);this.builder=e?null:t}getPageUrl(){return"/"+this.file.replace(/\.page\.html$/,"").split("/").filter(Boolean).join("/")}buildContents(e,t){const a=this.templates.find(t=>t.name===e),i=(a?.locations||[{name:"default",label:null}]).map(e=>"string"==typeof e?{name:e,label:null}:e),s=i.map(({name:e,label:a})=>{const i=t.find(t=>t.location===e);return{location:e,label:a||null,content:i?.content||"",orphaned:!1}});for(const e of t)i.some(t=>t.name===e.location)||s.push({location:e.location,label:null,content:e.content,orphaned:!0});return s}getFormState(){if(this.inBuilder)return{...this.meta,contents:this.contents.map(({location:e,content:t})=>({location:e,content:t}))};const e=this.shadowRoot,t=new Map([...e.querySelectorAll("[data-location]")].map(e=>[e.dataset.location,e.getValue()]));return{name:e.querySelector("#metaName").value,title:e.querySelector("#metaTitle").value,description:e.querySelector("#metaDescription").value,template:e.querySelector("#metaTemplate").value,contents:this.contents.map(({location:e,content:a,orphaned:i})=>({location:e,content:i?t.get(e)?.trim()||a:t.get(e)??a}))}}get inBuilder(){return"builder"===this.builder?.state&&!this.page?.locked}get pageName(){return this.meta?.name||this.meta?.title||this.page?.name||this.page?.title||this.file}async persist(){if(!this.inBuilder){const[e,t]=await o({file:this.file,...this.getFormState()});return[e,t]}const e=this.shadowRoot.querySelector("admin-page-builder"),t=this.getFormState(),a=Object.fromEntries(t.contents.filter(e=>k.has(e.location)).map(e=>[e.location,e.content])),[i,s]=await u({file:this.file,trees:e.getTrees(),codeBlocks:a,changes:{name:t.name,title:t.title,description:t.description,template:t.template},loadedHash:this.builder.hash});return i?[i,null]:(this.builder={...this.builder,hash:s.hash},e.markSaved(),[null,s])}save=()=>this.saving||this.page?.locked?Promise.resolve():this.handleSave();handleKeyDown=e=>{this.inBuilder||(e.ctrlKey||e.metaKey)&&"s"===e.key&&(e.preventDefault(),this.save())};handleTemplateChange=e=>{if(this.page?.locked)return;const t=e.target.value,a=new Map([...this.shadowRoot.querySelectorAll("[data-location]")].map(e=>[e.dataset.location,e.getValue()])),i=this.contents.map(({location:e,content:t})=>({location:e,content:a.get(e)?.trim()||t}));this.contents=this.buildContents(t,i),this.page={...this.page,template:t}};handleDelete=()=>{f.confirm("Delete this page? This action cannot be undone.",async e=>{if(!e)return;const[t]=await c([this.file]);t?y.error(t.msg||"Failed to delete page"):(y.success("Page deleted"),setTimeout(()=>{window.location.href="/admin/pages"},1e3))})};handleMove=async()=>{const[,e]=await d(),a=e?.directories||["."],i=this.file.replace(/\.page\.html$/,"").split("/"),s=i.pop(),l=i.join("/")||".",n=e=>/^\/[a-zA-Z0-9_\-\[\]\/]*$/.test(e)&&!e.includes("..")&&!e.includes("//"),o=e=>(e||"/").replace(/^\//,"").replace(/\/$/,"")||".",r="."===l?"/":"/"+l,c=f.create(t`
      <div class="p">
        <div class="mb">
          <label class="d-b mb-sm"><strong>Location</strong></label>
          <input type="text" id="dlg-move-dir" class="full" list="dlg-move-dir-list" .value="${r}" placeholder="/">
          <datalist id="dlg-move-dir-list">
            ${a.map(e=>t`<option value="${"."===e?"/":"/"+e}">`)}
          </datalist>
          <p id="dlg-move-dir-error" class="mt-sm tc-danger d-n"><small>Invalid path — use format: /path/to/directory</small></p>
          <p class="mt-sm muted"><small>Supports dynamic segments e.g. <code>/blog/[slug]</code>. <button class="link" @click="${()=>f.alert(t`
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
    `,{title:"Move Page",confirmText:"Save and Move Page",confirmAction:async()=>{const e=c.querySelector("#dlg-move-dir").value.trim()||"/",t=T(c.querySelector("#dlg-move-name").value.trim());if(!t)return void y.error("Page name is required");if(!n(e))return void y.error("Invalid directory path");const a=o(e),i="."===a?`${t}.page.html`:`${a}/${t}.page.html`;this.saving=!0;const[s]=await this.persist();if(this.saving=!1,s)return void y.error(s.msg||"Failed to save page");const[l,r]=await p({file:this.file,newFile:i});l?y.error(l.msg||"Failed to move page"):(y.success("Page saved and moved"),setTimeout(()=>{window.location.href=`/admin/content/pages/edit?path=${encodeURIComponent(r.file.replace(/\.page\.html$/,""))}`},1e3))},cancelText:"Cancel"}),m=()=>{const e=o(c.querySelector("#dlg-move-dir").value||"/"),t=T(c.querySelector("#dlg-move-name").value),a="."===e?"/":"/"+e+"/";c.querySelector("#dlg-move-preview").textContent=t?a+t:""};c.querySelector("#dlg-move-dir").addEventListener("input",e=>{c.querySelector("#dlg-move-dir-error").classList.toggle("d-n",n(e.target.value||"/")),m()}),c.querySelector("#dlg-move-name").addEventListener("input",m),m()};handleCopy=()=>{const e=this.file.replace(/\.page\.html$/,"").split("/"),a=e.pop(),i=e.join("/"),s=f.create(t`
      <div class="p">
        <label class="d-b mbq" for="dlg-copy-path">Address of the copy<small class="d-b tc-muted">The copy is a separate page. Nothing links to it, so you can work on it privately and then replace the original with it.</small></label>
        <input type="text" id="dlg-copy-path" class="full" .value="${"/"+[i,`${a}-draft`].filter(Boolean).join("/")}">
      </div>
    `,{title:"Copy this page",confirmText:"Copy page",cancelText:"Cancel",confirmAction:async e=>{const t=s.querySelector("#dlg-copy-path").value;if(!t.trim().replace(/\//g,""))return e.keepDialogOpen=!0,void y.error("Give the copy an address");const[a]=await this.persist();if(a)return e.keepDialogOpen=!0,void y.error(a.msg||"Failed to save page");const[i,l]=await m({file:this.file,newFile:x(t)});if(i)return e.keepDialogOpen=!0,void y.error(i.msg||"Failed to copy page");y.success("Page copied"),setTimeout(()=>{window.location.href=`/admin/content/pages/edit?path=${encodeURIComponent(l.file.replace(/\.page\.html$/,""))}`},800)}})};handleReplace=async()=>{const[,e]=await h({showHidden:!0,limit:500}),a=(e?.pages||[]).map(e=>e.file).filter(e=>e&&e!==this.file),i=f.create(t`
      <div class="p">
        <label class="d-b mbq" for="dlg-replace-path">The page to replace<small class="d-b tc-muted">This page moves to that address and the page that is there now is deleted. If this page is a draft, that is how it is published.</small></label>
        <input type="text" id="dlg-replace-path" class="full" list="dlg-replace-list" placeholder="/about">
        <datalist id="dlg-replace-list">${a.map(e=>t`<option value="/${e.replace(/\.page\.html$/,"")}"></option>`)}</datalist>
      </div>
    `,{title:"Replace another page",confirmText:"Replace the page",cancelText:"Cancel",confirmAction:e=>{const t=i.querySelector("#dlg-replace-path").value;if(!t.trim().replace(/\//g,""))return e.keepDialogOpen=!0,void y.error("Enter the address of the page to replace");const a=x(t);f.confirm(`Replace /${a.replace(/\.page\.html$/,"")} with this page? The page that is there now will be deleted. This cannot be undone.`,async e=>{if(!e)return;const[t]=await this.persist();if(t)return void y.error(t.msg||"Failed to save page");const[i,s]=await p({file:this.file,newFile:a,overwrite:!0});i?y.error(i.msg||"Failed to replace the page"):(y.success("Page replaced"),setTimeout(()=>{window.location.href=`/admin/content/pages/edit?path=${encodeURIComponent(s.file.replace(/\.page\.html$/,""))}`},800))},{title:"Replace page"})}})};handleReset=()=>{f.confirm("Reset this page? Any unsaved changes will be lost.",async e=>{e&&await this.load()})};handleSave=async()=>{this.saving=!0;const e=this.getFormState(),[t,a]=await this.persist();if(this.saving=!1,t)return 409===t.code||/changed after you opened/i.test(t.msg||"")?void f.confirm("This page was changed somewhere else after you opened it, so it was not saved. Reload it to see what changed? Your unsaved changes here will be lost.",e=>{e&&this.load()},{title:"The page changed"}):void y.error(t.msg||"Failed to save page");const i=e.template!==this.page.template;this.metaDirty=!1,this.codeDirty=!1,this.contents=this.contents.map(t=>{const a=e.contents.find(e=>e.location===t.location);return a?{...t,content:a.content}:t}),this.page={...this.page,...e,contents:e.contents.filter(e=>e.content.trim()),updatedAt:a.updatedAt},document.title=`Edit: ${e.name||e.title||this.file} - Admin`,y.success("Page saved"),i&&this.inBuilder&&await this.load()};setMeta=e=>{this.meta={...this.meta,...e},this.metaDirty=!0};templateChoices=()=>{const e=this.file.replace(/\.page\.html$/,"").split("/").slice(0,-1).join("/")||".",t=this.templates.filter(t=>{const a="."===t.directory?"":t.directory,i="."===e?"":e;return""===a||i===a||i.startsWith(a+"/")}).map(e=>({name:e.name,label:"."===e.directory?`/${e.name}`:`/${e.directory}/${e.name}`}));return t.some(e=>e.name===this.meta.template)||t.unshift({name:this.meta.template,label:`${this.meta.template} (Not Found, using default)`}),t};openCode=e=>{const a=this.contents.find(t=>t.location===e);if(!a)return;const i="head"===e?"Head":e,s=f.create(t`
      <div class="p">
        <p class="tc-muted">Code placed in the page's head. It is saved with the page and is not changed by the builder.</p>
        <k-code-editor id="dlg-code" class="r b" language="html" controls="normal" .value="${/^\s*(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)?$/i.test(a.content)?"":a.content}"></k-code-editor>
      </div>
    `,{title:i,confirmText:"Apply",cancelText:"Cancel",width:"min(70rem, 95vw)",confirmAction:()=>{const t=s.querySelector("#dlg-code").getValue();t!==a.content&&(this.contents=this.contents.map(a=>a.location===e?{...a,content:t}:a),this.codeDirty=!0)}})};showConflict(){const{conflict:e}=this.builder,a=async e=>{s.close();const[t,a]=await b({file:this.file,keep:e,loadedHash:this.builder.hash});t?y.error(t.msg||"The choice could not be saved"):(this.builder=a,y.success("file"===e?"Kept the file":"Kept the builder's copy"))},i=e=>e?new Date(e).toLocaleString():"unknown",s=f.create(t`
      <div class="p">
        <p>This page's file was changed outside the page builder, so it no longer matches the builder's copy. Choose which one to keep. The other is replaced, and both are saved to match.</p>
        ${e.fileRebuildable?"":t`<p class="r p bc-warning tc-warning">The builder cannot edit the file's version (${e.fileReason}). If you keep it, this page can only be edited as code. The builder's last version is kept in case you want to go back to it.</p>`}
        <div class="d-f" style="gap: var(--spacer); align-items: stretch;">
          <div class="flex">
            <h6 class="mb0">The file</h6>
            <p class="tc-muted mbq">Changed ${i(e.fileModifiedAt)}</p>
            <iframe title="The file's version" class="full b r" style="height: 22rem;" sandbox="allow-scripts allow-same-origin" srcdoc="${C(e.filePreview)}"></iframe>
            <button class="primary full mt" @click="${()=>a("file")}">Keep the file</button>
          </div>
          <div class="flex">
            <h6 class="mb0">The builder's copy</h6>
            <p class="tc-muted mbq">Saved ${i(e.rowSavedAt)}</p>
            <iframe title="The builder's version" class="full b r" style="height: 22rem;" sandbox="allow-scripts allow-same-origin" srcdoc="${C(e.rowPreview)}"></iframe>
            <button class="primary full mt" @click="${()=>a("row")}">Keep the builder's copy</button>
          </div>
        </div>
      </div>
    `,{title:"This page was changed outside the builder",closeBtn:!1,overlayClose:!1,disableKeyboardClose:!0,width:"min(70rem, 95vw)"})}handleUseBuilder=async()=>{if(this.saving=!0,await this.openBuilder(),this.saving=!1,this.inBuilder)return void y.success("This page can be edited in the builder");if("code"!==this.builder?.state)return;const e=async e=>{a.close();const[t,i]=await v({file:this.file,mode:e,loadedHash:this.builder.hash});t?y.error(t.msg||"The page could not be moved to the builder"):(await this.load(),y.success("This page is now edited in the builder"))},a=f.create(t`
      <div class="p">
        <p>The builder cannot edit this page as it is${this.builder.reason?t` (${this.builder.reason})`:""}. To use the builder, the page's content has to be replaced.</p>
        <button class="danger full mb" @click="${()=>e("empty")}">Start over with an empty page</button>
        ${this.builder.hasLastGood?t`<button class="primary full mb" @click="${()=>e("lastGood")}">Start from the last good builder page</button>`:""}
        <p class="tc-muted">Your head is kept. The current content of the page is lost.</p>
      </div>
    `,{title:"Use the page builder",cancelText:"Cancel"})};renderContentTab({location:e,label:a,content:i,orphaned:n},o){const r=a||("default"===e?"Content":e.slice(0,1).toUpperCase()+e.slice(1)),c=l($("page-content-editor","k-html-editor")),d=k.has(e)?{nodes:[],controls:[]}:w(),p=k.has(e)||"code"===this.builder?.state;return t`
      <k-tab for="content-${e}">
        ${r}${n?t` <span class="tc-warning"><small>(not in template)</small></span>`:""}
      </k-tab>
      <k-tab-content name="content-${e}">
        <div class="p">
          ${s`<${c}
            class="r b"
            data-location="${e}"
            controls="full"
            .value="${i}"
            mode="${p?"code":"visual"}"
            nodes="${d.nodes.join(",")}"
            ?disabled="${o}"
          >${d.controls.map(e=>s`<${l(e)} slot="toolbar-top-extra"></${l(e)}>`)}</${c}>`}
        </div>
      </k-tab-content>
    `}render(){if(this.loading)return t`<div>Loading page...</div>`;const e=this.inBuilder,a=this.contents.some(e=>"default"===e.location)?"content-default":"metadata";if(this.error)return t`
      <div>
        <p>Page not found.</p>
        <a href="/admin/pages">Back to Pages</a>
      </div>
    `;const{page:s,templates:l,contents:n}=this,o="system"===s.owner,r=s.locked;return"conflict"===this.builder?.state?t`
      <h1 class="mb0">Page: ${s.name||s.title||this.file}</h1>
      <p class="tc-muted">Choose which version of this page to keep to continue.</p>
    `:e?t`<admin-page-builder .data="${this.builder}" .host="${this}" .saving="${this.saving}" .meta="${this.meta}"></admin-page-builder>`:t`
      ${r?t`
        <div class="p r mb bc-warning tc-warning">
          <k-icon name="lock"></k-icon> This page is locked and cannot be edited. ${"custom"===s.owner?"Locked by developer":`Managed by: ${s.owner||"external system"}`}
        </div>
      `:""}
      ${"code"===this.builder?.state?t`
        <div class="p r mb bc-warning d-f" style="align-items: center; gap: var(--spacer);">
          <span class="flex"><k-icon name="code"></k-icon> This page is edited as code${this.builder.reason?t`: ${this.builder.reason}`:""}.</span>
          ${r?"":t`<button ?disabled="${this.saving}" @click="${this.handleUseBuilder}">Use the page builder</button>`}
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
        <div class="btn-grp mrh mb">
          ${o||r?"":t`
            <button class="danger" @click="${this.handleDelete}"><k-icon name="delete"></k-icon> Delete</button>
            <button @click="${this.handleMove}"><k-icon name="drive_file_move"></k-icon> Move Page</button>
          `}
          <button @click="${this.handleCopy}"><k-icon name="content_copy"></k-icon> Copy Page</button>
          ${o||r?"":t`<button @click="${this.handleReplace}"><k-icon name="repeat"></k-icon> Replace Page</button>`}
        </div>
        ${r?"":t`
          <div class="btn-grp mrh mb">
            <button @click="${this.handleReset}"><k-icon name="restart_alt"></k-icon> Reset</button>
            <button id="saveBtn" class="primary" ?disabled="${this.saving}" @click="${this.handleSave}">
              <k-icon name="save"></k-icon> Save
            </button>
          </div>
        `}
      </div>
      <h1 class="mb0">Page: ${s.name||s.title||this.file}</h1>

      <a href="${this.getPageUrl()}" class="d-b mb"><code>${this.getPageUrl()}</code></a>

      <k-tabs active="${a}">
        <k-tab for="metadata">Metadata</k-tab>
        <k-tab-content name="metadata">
          <div class="p">
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Name</strong></label>
              <input type="text" id="metaName" class="flex" .value="${s.name||""}" ?disabled="${o||r}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Title</strong></label>
              <input type="text" id="metaTitle" class="flex" .value="${s.title||""}" ?disabled="${r}">
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Description</strong></label>
              <input type="text" id="metaDescription" class="flex" .value="${s.description||""}" ?disabled="${o||r}">
            </div>
            ${o?"":t`
              <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                <label style="min-width: 120px;"><strong>Author</strong></label>
                <span class="muted">${s.author||""}</span>
              </div>
            `}
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Template</strong></label>
              ${(()=>{const e=this.file.replace(/\.page\.html$/,"").split("/").slice(0,-1).join("/")||".",a=l.filter(t=>{const a="."===t.directory?"":t.directory,i="."===e?"":e;return""===a||i===a||i.startsWith(a+"/")}),i=a.some(e=>e.name===s.template);return t`
                  <select id="metaTemplate" class="flex" @change="${this.handleTemplateChange}" ?disabled="${r}">
                    ${i?"":t`<option value="${s.template}" selected>${s.template} (Not Found, using default)</option>`}
                    ${a.map(e=>t`
                      <option value="${e.name}" ?selected="${e.name===s.template}">${(e=>"."===e.directory?`/${e.name}`:`/${e.directory}/${e.name}`)(e)}</option>
                    `)}
                  </select>
                `})()}
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Owner</strong></label>
              <span class="muted">${s.owner||""}</span>
            </div>
            <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Created</strong></label>
              <span class="muted">${s.createdAt?new Date(s.createdAt).toLocaleString():""}</span>
            </div>
            <div class="d-f" style="align-items: center; gap: var(--spacer);">
              <label style="min-width: 120px;"><strong>Updated</strong></label>
              <span class="muted">${s.updatedAt?new Date(s.updatedAt).toLocaleString():""}</span>
            </div>
          </div>
        </k-tab-content>
        ${Object.keys(s.extraMetadata||{}).length?t`
          <k-tab for="extra-metadata">Extra Metadata</k-tab>
          <k-tab-content name="extra-metadata">
            <div class="p">
              ${Object.entries(s.extraMetadata).map(([e,a])=>t`
                <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
                  <label style="min-width: 120px;" class="muted"><strong>${e}</strong></label>
                  <span>${a}</span>
                </div>
              `)}
              <p class="muted mt0"><small>Extra metadata is managed by extensions and cannot be edited here.</small></p>
            </div>
          </k-tab-content>
        `:""}
        ${i(n,e=>e.location,e=>this.renderContentTab(e,r))}
      </k-tabs>
    `}}customElements.define("admin-page-editor",S);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\PageEditor.js.map