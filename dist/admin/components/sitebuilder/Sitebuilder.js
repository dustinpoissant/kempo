import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,css as s,render as i}from"/kempo-ui/lit-all.min.js";import n from"/kempo-ui/components/Dialog.js";import r from"/kempo-ui/components/Toast.js";import{getSitebuilderWidgets as o,listFragments as a,listSitebuilderTemplates as l,createSitebuilderTemplate as d,deleteSitebuilderTemplate as h}from"/kempo/sdk.js";import{buildRegistry as c}from"/kempo/sitebuilder/registry.js";import p from"/kempo/sitebuilder/history.js";import{cloneNode as m,findNode as g,isInside as u}from"/kempo/sitebuilder/nodes.js";import{canContain as f}from"/kempo/sitebuilder/render.js";import{acceptingSlot as v,addWidget as b,duplicateWidgets as y,freshCopies as w,insertNodes as $,moveBy as k,moveIn as S,moveOut as D,moveWidget as C,neighbour as x,removeWidgets as T,sharePlace as O}from"/kempo/sitebuilder/ops.js";import I from"./frame.js";import"./SitebuilderTree.js";import"./SitebuilderAttributes.js";import"./SitebuilderInserter.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Toggle.js";import"/kempo-ui/components/Dropdown.js";const K="sitebuilder:settings",j=[["phone","Phone","smartphone"],["tablet","Tablet","tablet"],["desktop","Desktop","desktop"]],_=/^Already /;export default class N extends e{static properties={data:{attribute:!1},host:{attribute:!1},meta:{attribute:!1},saving:{type:Boolean},ready:{state:!0},location:{state:!0},selection:{state:!0},treeOpen:{state:!0},attrsOpen:{state:!0},device:{state:!0},version:{state:!0}};constructor(){super(),this.ready=!1,this.location="default",this.selection=[],this.treeOpen=!0,this.attrsOpen=!0,this.device="desktop",this.version=0,this.saving=!1,this.trees={},this.savedJson="",this.history=new p,this.coalesceKey=null,this.coalesceTime=0,this.variables=[],this.fragments=[],this.settings=(()=>{try{return{confirmDeletion:!1,...JSON.parse(localStorage.getItem(K)||"{}")}}catch{return{confirmDeletion:!1}}})()}static styles=s`
    :host { display: block; height: 100%; }
    .sb { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--c_border, #8884); }
    .bar .spacer { flex: 1; }
    .bar select { width: auto; align-self: stretch; }
    .menu { display: flex; flex-direction: column; min-width: 14rem; padding: 0.25rem; }
    .menu button { text-align: left; border: 0; }
    .body { display: flex; flex: 1; min-height: 0; }
    aside { overflow: auto; flex: none; }
    aside.tree { width: 18rem; border-right: 1px solid var(--c_border, #8884); }
    aside.attrs { width: 22rem; border-left: 1px solid var(--c_border, #8884); }
    .canvas { flex: 1; min-width: 0; overflow: auto; background: var(--c_bg__alt, #8881); }
    iframe { display: block; width: 100%; height: 100%; border: 0; background: var(--c_bg, #fff); margin: 0 auto; }
    .tablet iframe { width: 768px; max-width: 100%; }
    .phone iframe { width: 390px; max-width: 100%; }
    .loading { padding: 2rem; text-align: center; }
  `;connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.handleKeyDown),window.addEventListener("beforeunload",this.handleBeforeUnload)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.handleKeyDown),window.removeEventListener("beforeunload",this.handleBeforeUnload)}async updated(e){super.updated(e),e.has("data")&&this.data&&!this.ready&&await this.start()}async start(){const[,e]=await o();this.registry=c(e?.widgets||[]),this.variables=this.data.page?.variables||[],this.trees=structuredClone(this.data.trees||{});const t=this.visualLocations();this.location=t[0]?.name||"default";for(const{name:e}of t)this.trees[e]=this.trees[e]||[];this.savedJson=JSON.stringify(this.trees),this.frame=new I(this.renderRoot.querySelector("iframe"),this.registry,{onSelect:(e,t)=>this.select(e,t),onBlank:()=>this.setSelection([]),onText:(e,t,s)=>this.setAttribute(e,t,s,!0,!1),onCell:(e,t,s,i)=>this.setCell(e,t,s,i),onChange:(e,t)=>this.change(s=>(Object.assign(g(s,e).node.attrs,t),!0),{coalesce:`${e}:widget`,render:!1}),onDrop:(e,t)=>this.moveTo(e,t,!0),restricted:e=>!!this.registry.get(this.find(e)?.node.type)?.only_in?.length,canDrop:(e,t,s)=>{const i=this.find(e);return!(!i||t&&(t===e||u(this.nodes,e,t)))&&f(this.registry,t?this.find(t)?.node:null,s,i.node.type)},onKeyDown:this.handleKeyDown,locate:e=>this.locate(e)}),this.ready=!0,await this.frame.render(this.nodes,this.selection),a().then(([,e])=>{this.fragments=(e?.fragments||[]).map(e=>e.name||String(e.file||"").replace(/\.fragment\.html$/,"")).filter(Boolean),this.requestUpdate()})}visualLocations(){return(this.data?.locations||[]).filter(e=>!e.code)}get nodes(){return this.trees[this.location]=this.trees[this.location]||[],this.trees[this.location]}get dirty(){return this.ready&&(JSON.stringify(this.trees)!==this.savedJson||!!this.host?.extrasDirty)}find=e=>e?g(this.nodes,e):null;locate=e=>{const t=this.find(e);return t?{parentId:t.parent?.id??null,slot:t.slot,index:t.index}:null};getTrees(){return structuredClone(this.trees)}markSaved(e){if(e)for(const[t,s]of Object.entries(e))this.trees[t]=s;this.savedJson=JSON.stringify(this.trees),this.prune(),this.refresh()}refresh(){this.version++,this.frame?.render(this.nodes,this.selection)}prune(){const e=this.selection.filter(e=>this.find(e));e.length!==this.selection.length&&(this.selection=e)}change(e,{coalesce:t=null,render:s=!0}={}){const i=structuredClone(this.trees),n=e(this.nodes),o="string"==typeof n?n:n?.error;if(o)return this.trees=i,_.test(o)||r.error(o),!1;const a=Date.now();return t&&this.coalesceKey===t&&a-this.coalesceTime<1e3||this.history.push(i),this.coalesceKey=t,this.coalesceTime=a,n?.select&&(this.selection=n.select),this.prune(),s?this.refresh():this.version++,!0}select=(e,{additive:t=!1}={})=>{let s=[e];t&&(this.selection.includes(e)?s=this.selection.filter(t=>t!==e):O(this.nodes,[...this.selection,e])&&(s=[...this.selection,e])),this.setSelection(s)};setSelection(e){this.selection=e,this.frame?.setSelection(e),e[0]&&this.frame?.scrollTo(e[0]),this.version++}addChild=(e,t,s="default")=>{this.change(i=>{const n=b(i,this.registry,t,{targetId:e,inside:!0,slot:s});return!n.error||n})};handleTreeClick=e=>{e.composedPath().some(e=>e.matches?.(".row, button"))||this.setSelection([])};selectParent=()=>{const e=1===this.selection.length?this.find(this.selection[0])?.parent:null;this.setSelection(e?[e.id]:[])};setAttribute=(e,t,s,i=!1,n=!0)=>{this.change(i=>{const{node:n}=g(i,e);return n.attrs[t]=s,!0},{coalesce:i?`${e}:${t}`:null,render:n})};setCell(e,t,s,i){this.change(n=>{const{node:r}=g(n,e),o=r.attrs.rows?.length?r.attrs.rows:[["",""],["",""]];return o[t]&&(o[t][s]=i),r.attrs.rows=o,!0},{coalesce:`${e}:cell:${t},${s}`,render:!1})}placement(){return{targetId:this.selection[this.selection.length-1]??null}}canAdd=e=>!b(structuredClone(this.nodes),this.registry,e,this.placement()).error;openInserter=()=>{const e=document.createElement("admin-sitebuilder-inserter");e.registry=this.registry,e.host=this,this.inserterDialog=n.create(e,{title:"Add a widget",cancelText:"Close"})};insert=e=>{this.inserterDialog?.close(),this.change(t=>{const s=b(t,this.registry,e,this.placement());return s.error?s:{select:[s.id]}})};remove=()=>{if(!this.selection.length)return;const e=[...this.selection],t=()=>this.change(t=>{const s=x(t,e[0]);return T(t,e),{select:s&&!e.includes(s)?[s]:[]}});this.settings.confirmDeletion?n.confirm(`Delete ${e.length>1?`these ${e.length} widgets`:"this widget"}?`,e=>e&&t(),{title:"Delete"}):t()};moveUp=()=>this.selection.length&&this.change(e=>k(e,this.registry,this.selection,-1));moveDown=()=>this.selection.length&&this.change(e=>k(e,this.registry,this.selection,1));moveOutOf=()=>1===this.selection.length&&this.change(e=>D(e,this.registry,this.selection[0]));moveInto=()=>1===this.selection.length&&this.change(e=>S(e,this.registry,this.selection[0]));duplicate=()=>{this.selection.length&&this.change(e=>{const t=y(e,this.selection);return t.error?t:{select:t.ids}})};moveTo(e,t,s=!1){this.change(i=>{const n=C(i,this.registry,e,t.parentId,t.slot,t.index);return!0!==n||s?n:{select:[e]}})}dropOn=(e,t,s)=>{const i=this.find(t),n=this.find(e);if(i&&n){if("inside"===s){const s=v(this.registry,i.node,n.node.type);if(!s)return;return void this.moveTo(e,{parentId:t,slot:s,index:1/0})}this.dropNear(e,t,"before"===s)}};dropNear(e,t,s){const i=this.find(e);if(!i||e===t||u(this.nodes,e,t))return;let n=this.find(t);for(;n;){if(f(this.registry,n.parent,n.slot,i.node.type))return void this.moveTo(e,{parentId:n.parent?.id??null,slot:n.slot,index:n.index+(s?0:1)});n=n.parent?this.find(n.parent.id):null}r.error(`${this.registry.get(i.node.type)?.title??"That widget"} cannot go there`)}undo=()=>{const e=this.history.undo(this.trees);e&&(this.trees=e,this.coalesceKey=null,this.prune(),this.refresh())};redo=()=>{const e=this.history.redo(this.trees);e&&(this.trees=e,this.coalesceKey=null,this.prune(),this.refresh())};setLocation(e){this.location=e,this.setSelection([]),this.refresh()}saveTemplate=()=>{if(!this.selection.length)return void r.error("Select a widget to save as a template");const e=this.selection.map(e=>m(this.find(e).node)).filter(Boolean),s=n.create(t`
      <div class="p">
        <label class="d-b mbq" for="sb-template-name">Template name<small class="d-b tc-muted">Inserting a template makes a copy, so changing it later does not change the pages that used it.</small></label>
        <input id="sb-template-name" type="text" class="full" maxlength="100">
      </div>
    `,{title:"Save as a template",confirmText:"Save template",cancelText:"Cancel",confirmAction:async t=>{const i=s.querySelector("#sb-template-name");if(!i.value.trim())return t.keepDialogOpen=!0,void r.error("Give the template a name");const[n]=await d({name:i.value.trim(),nodes:e});if(n)return t.keepDialogOpen=!0,void r.error(n.msg||"The template could not be saved");r.success("Template saved")}})};insertTemplate=async()=>{const[e,s]=await l();if(e)return void r.error(e.msg||"The templates could not be loaded");let o=s.templates;const a=document.createElement("div"),d=()=>i(t`
      <div class="p">
        ${o.length?o.map(e=>t`
          <div class="d-f mb" style="align-items: center; gap: var(--spacer);">
            <span class="flex">${e.name}</span>
            <button class="primary" @click="${()=>{c.close(),this.insertTemplateNodes(e)}}">Insert</button>
            <button class="danger" @click="${async()=>{const[t]=await h(e.id);t?r.error(t.msg||"The template could not be deleted"):(o=o.filter(t=>t.id!==e.id),d())}}">Delete</button>
          </div>
        `):t`<p class="tc-muted">No templates yet. Select a widget and use Save as a template.</p>`}
      </div>
    `,a);d();const c=n.create(a,{title:"Insert a template",cancelText:"Close"})};insertTemplateNodes(e){this.change(t=>{const s=w(e.nodes),i=$(t,this.registry,s,this.placement());return i.error?i:{select:i.ids}})}openSettings=()=>{const e=document.createElement("div");(()=>{i(t`
      <div class="p">
        <div class="d-f" style="align-items: center; gap: var(--spacer);">
          <k-toggle id="sb-setting-confirm" .value="${this.settings.confirmDeletion}" @change="${e=>{this.settings={...this.settings,confirmDeletion:e.detail.value};try{localStorage.setItem(K,JSON.stringify(this.settings))}catch{}}}"></k-toggle>
          <label for="sb-setting-confirm">Confirm deletion<small class="d-b tc-muted">Ask before the Delete key or the remove button deletes a widget.</small></label>
        </div>
      </div>
    `,e)})(),n.create(e,{title:"Editor settings",cancelText:"Close"})};openShortcuts=()=>{n.create(t`
      <div class="p">
        <p class="tc-muted">On a Mac, Ctrl means Cmd. Inside text the browser's own shortcuts work (Ctrl + B and the rest), and Ctrl + Z and Delete stay the text's own, so one key never does two things.</p>
        <table>
          <thead><tr><th>Keys</th><th>Does</th></tr></thead>
          <tbody>${[["Click","Select the outermost widget under the pointer. Each click inside it selects the next widget down, and clicking the selected widget edits its text."],["Shift or Ctrl + click","Add the widget beside the selected one (same parent) to the selection."],["Drag the handle","Move the selected widget: drop it in a box that shows on the page. Letting go anywhere else cancels."],["Ctrl + S","Save the page."],["Ctrl + D","Duplicate the selected widgets."],["Ctrl + Z","Undo."],["Ctrl + Shift + Z, Ctrl + Shift + Y or Ctrl + Y","Redo."],["Delete or Backspace","Delete the selected widgets."],["Escape","Stop typing and keep the widget selected. Pressed again, select its parent, and at the top of the page select nothing, which shows the page settings."],["Alt + Shift + Up or Down","Move the selection up or down."],["Alt + Shift + Left","Move the selection out of its parent."],["Alt + Shift + Right","Move the selection into the widget before it."]].map(([e,s])=>t`<tr><td><strong>${e}</strong></td><td>${s}</td></tr>`)}</tbody>
        </table>
      </div>
    `,{title:"Keyboard shortcuts",cancelText:"Close",width:"min(48rem, 95vw)"})};isTyping(e){const t=e.composedPath(),s=t.find(e=>e.dataset?.sbId);return!(s&&!this.selection.includes(s.dataset.sbId))&&t.some(e=>e.matches?.("input, textarea, select, [contenteditable]")||"K-HTML-EDITOR"===e.tagName)}handleKeyDown=e=>{if(!this.ready)return;const t=e.ctrlKey||e.metaKey,s=e.key.toLowerCase(),i=this.isTyping(e);if(t&&"s"===s)return e.preventDefault(),void this.host?.save();if(t&&"d"===s&&this.selection.length)return e.preventDefault(),void this.duplicate();if(t&&!e.altKey&&("z"===s||"y"===s)){if(i)return;return e.preventDefault(),void("y"===s||e.shiftKey?this.redo():this.undo())}return e.altKey&&e.shiftKey&&s.startsWith("arrow")?(e.preventDefault(),void("arrowup"===s?this.moveUp():"arrowdown"===s?this.moveDown():"arrowleft"===s?this.moveOutOf():this.moveInto())):"escape"===s?i?(document.activeElement?.blur?.(),void this.frame?.blurFocus()):void this.selectParent():void("delete"!==s&&"backspace"!==s||i||!this.selection.length||(e.preventDefault(),this.remove()))};handleBeforeUnload=e=>{this.dirty&&(e.preventDefault(),e.returnValue="")};renderBar(){const e=this.host,s=1===this.selection.length,i=this.selection.length>0,n=this.visualLocations(),r="system"===e?.page?.owner,o=(this.data?.locations||[]).filter(e=>e.code).map(e=>e.name),a=(e,s,i,{disabled:n=!1,direction:r="",className:o=""}={})=>t`<button class="${o}" title="${s}" aria-label="${s}" ?disabled="${n}" @click="${i}"><k-icon name="${e}" direction="${r}"></k-icon></button>`,l=(e,s,i,n="")=>t`<button data-value="${s}" class="${n}" @click="${i}"><k-icon name="${e}"></k-icon> ${s}</button>`;return t`
      <div class="bar">
        ${a("account_tree",(this.treeOpen?"Hide":"Show")+" the widget tree",()=>{this.treeOpen=!this.treeOpen},{className:this.treeOpen?"primary":""})}
        <div class="btn-grp">
          <a href="/admin/content/pages" class="btn" title="Back to the pages" aria-label="Back to the pages"><k-icon name="arrow" direction="left"></k-icon></a>
          <a href="${e.getPageUrl()}" target="_blank" rel="noopener" class="btn" id="page-link" title="Open the page in a new tab" aria-label="Open the page in a new tab"><k-icon name="open_in_browser"></k-icon></a>
        </div>
        <div class="btn-grp">
          ${a("add","Add a widget",this.openInserter,{className:"primary"})}
          ${a("delete","Delete",this.remove,{disabled:!i})}
          ${a("arrow","Move up",this.moveUp,{disabled:!i,direction:"up"})}
          ${a("arrow","Move down",this.moveDown,{disabled:!i,direction:"down"})}
          ${a("arrow","Move into the widget before it",this.moveInto,{disabled:!s,direction:"right"})}
          ${a("arrow","Move out of its parent",this.moveOutOf,{disabled:!s,direction:"left"})}
        </div>
        <div class="btn-grp">
          ${a("content_copy","Duplicate (Ctrl+D)",this.duplicate,{disabled:!i})}
          <k-dropdown open-direction="down left">
            ${l("save","Save template",this.saveTemplate)}
            ${l("folder-open","Insert template",this.insertTemplate)}
            <button slot="trigger" title="Templates" aria-label="Templates"><k-icon name="dashboard"></k-icon></button>
          </k-dropdown>
        </div>
        <div class="btn-grp">
          ${j.map(([e,t,s])=>a(s,`Preview on a ${t.toLowerCase()}`,()=>{this.device=e,this.frame?.placeHandle()},{className:this.device===e?"primary":""}))}
        </div>
        ${n.length>1?t`
          <select aria-label="Content area" @change="${e=>this.setLocation(e.target.value)}">
            ${n.map(e=>t`<option value="${e.name}" ?selected="${e.name===this.location}">${e.label||("default"===e.name?"Content":e.name)}</option>`)}
          </select>
        `:""}
        <span class="spacer"></span>
        <div class="btn-grp">
          ${a("undo","Undo (Ctrl+Z)",this.undo,{disabled:!this.history.canUndo})}
          ${a("redo","Redo (Ctrl+Shift+Z)",this.redo,{disabled:!this.history.canRedo})}
        </div>
        ${a("save",this.dirty?"Save the page (Ctrl+S). There are unsaved changes.":"Save the page (Ctrl+S)",()=>e.save(),{disabled:this.saving,className:this.dirty?"primary":""})}
        <k-dropdown open-direction="down left">
          <button slot="trigger" title="More" aria-label="More"><k-icon name="more_vert"></k-icon></button>
          ${o.includes("head")?l("code","Head code",()=>e.openCode("head")):""}
          ${o.includes("scripts")?l("code","Scripts code",()=>e.openCode("scripts")):""}
          ${l("settings","Editor settings",this.openSettings)}
          ${l("keyboard","Keyboard shortcuts",this.openShortcuts)}
          ${l("content_copy","Copy page",e.handleCopy)}
          ${r?"":l("drive_file_move","Move page",e.handleMove)}
          ${r?"":l("repeat","Replace another page",e.handleReplace)}
          ${l("restart_alt","Reset",e.handleReset)}
          ${r?"":l("delete","Delete page",e.handleDelete,"tc-danger")}
        </k-dropdown>
        ${a("tune",(this.attrsOpen?"Hide":"Show")+" the widget settings",()=>{this.attrsOpen=!this.attrsOpen},{className:this.attrsOpen?"primary":""})}
      </div>
    `}render(){const e=1===this.selection.length?this.find(this.selection[0])?.node:null;return t`
      <div class="sb">
        ${this.ready?this.renderBar():""}
        <div class="body">
          ${this.ready&&this.treeOpen?t`<aside class="tree" @click="${this.handleTreeClick}"><admin-sitebuilder-tree .nodes="${this.nodes}" .registry="${this.registry}" .selection="${this.selection}" .host="${this}"></admin-sitebuilder-tree></aside>`:""}
          <div class="canvas ${this.device}">
            ${this.ready?"":t`<div class="loading">Loading the editor</div>`}
            <iframe title="Page content" ?hidden="${!this.ready}"></iframe>
          </div>
          ${this.ready&&this.attrsOpen?t`<aside class="attrs"><admin-sitebuilder-attributes .node="${e}" .count="${this.selection.length}" .meta="${this.meta}" .version="${this.version}" .registry="${this.registry}" .host="${this}"></admin-sitebuilder-attributes></aside>`:""}
        </div>
      </div>
    `}}customElements.define("admin-sitebuilder",N);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\Sitebuilder.js.map