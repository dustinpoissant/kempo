import t from"/kempo-ui/components/ShadowComponent.js";import{html as e}from"/kempo-ui/lit-all.min.js";import{titleOf as s}from"./labels.js";import i from"./widgetIcon.js";import{supportsMargin as a}from"/kempo/sitebuilder/margins.js";import"./SitebuilderFields.js";import"./SitebuilderMargin.js";import"/kempo-ui/components/Icon.js";export default class n extends t{static properties={node:{attribute:!1},count:{type:Number},registry:{attribute:!1},host:{attribute:!1},meta:{attribute:!1},version:{type:Number}};constructor(){super(),this.node=null,this.count=0}async updated(){const t=this.renderRoot.querySelector(".custom"),e=this.node&&this.registry?.get(this.node.type);t&&e?.settings_tag&&(customElements.get(e.settings_tag)||await(import(e.settings_component)),t.firstElementChild?.localName!==e.settings_tag&&t.replaceChildren(document.createElement(e.settings_tag)),Object.assign(t.firstElementChild,{node:this.node,registry:this.registry,host:this.host,version:this.version}))}renderPage(){const t=this.host.host,{meta:s,page:i}={meta:t?.meta,page:t?.page};if(!s||!i)return e`<div class="p tc-muted">Select a widget to edit its settings.</div>`;const a="system"===i.owner,n=(i,a,n=!1)=>e`
      <div class="mb">
        <label class="d-b mbq" for="sb-page-${i}">${a}</label>
        <input id="sb-page-${i}" type="text" class="full" .value="${s[i]}" ?disabled="${n}" @input="${e=>t.setMeta({[i]:e.target.value})}">
      </div>`,o=(t,s)=>e`<p class="mbq"><strong class="d-b">${t}</strong><span class="tc-muted">${s}</span></p>`;return e`
      <div class="p">
        <h5 class="mb"><k-icon name="settings"></k-icon> Page settings</h5>
        <p class="tc-muted">Select a widget on the page to edit its settings.</p>
        ${n("name","Name",a)}
        ${n("title","Title")}
        ${n("description","Description",a)}
        <div class="mb">
          <label class="d-b mbq" for="sb-page-template">Template</label>
          <select id="sb-page-template" class="full" @change="${e=>t.setMeta({template:e.target.value})}">
            ${t.templateChoices().map(t=>e`<option value="${t.name}" ?selected="${t.name===s.template}">${t.label}</option>`)}
          </select>
        </div>
        ${a?"":o("Author",i.author||"")}
        ${o("Owner",i.owner||"")}
        ${o("Created",i.createdAt?new Date(i.createdAt).toLocaleString():"")}
        ${o("Updated",i.updatedAt?new Date(i.updatedAt).toLocaleString():"")}
        ${Object.entries(i.extraMetadata||{}).map(([t,e])=>o(t,e))}
      </div>
    `}render(){if(this.count>1)return e`<div class="p tc-muted">${this.count} widgets are selected. Select one to edit its settings.</div>`;if(!this.node)return this.renderPage();const t=this.registry.get(this.node.type);return e`
      <div class="p">
        <h5 class="mb">${i(t)} ${s(this.registry,this.node)}</h5>
        ${t?.description?e`<p class="tc-muted">${t.description}</p>`:""}
        ${"unknown"===this.node.type?e`<p class="tc-muted">This content comes from something that is not installed. It is kept exactly as it was, and can be moved or deleted.</p>`:""}
        ${"markup"===this.node.type?e`<p class="tc-muted">Click the text on the page to edit it.</p>`:""}
        ${t?.settings_tag?e`<div class="custom"></div>`:e`<admin-sitebuilder-fields .node="${this.node}" .registry="${this.registry}" .host="${this.host}" .version="${this.version}"></admin-sitebuilder-fields>`}
        ${a(t)?e`<admin-sitebuilder-margin .node="${this.node}" .host="${this.host}" .version="${this.version}"></admin-sitebuilder-margin>`:""}
      </div>
    `}}customElements.define("admin-sitebuilder-attributes",n);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\sitebuilder\SitebuilderAttributes.js.map