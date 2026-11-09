import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,css as a}from"/kempo-ui/lit-all.min.js";import s from"/kempo-ui/components/PageBuilder.js";import i from"/kempo-ui/components/pagebuilder/PageBuilderFields.js";import o from"/kempo-ui/components/Toast.js";import{getSitebuilderWidgets as n,listSitebuilderTemplates as l,createSitebuilderTemplate as r,deleteSitebuilderTemplate as d}from"/kempo/sdk.js";import c from"/kempo/pagebuilder/serverWidgets.js";import h from"/kempo/pagebuilder/coreWidgets.js";import p from"/kempo/pagebuilder/rawHtml.js";import{setVariables as m}from"./ServerWidgetSettings.js";import"/kempo-ui/components/Icon.js";import"/kempo/components/IconPicker.js";import"./controls/PageControl.js";import"./controls/LocationControl.js";const u=["/styles.css"];let g=null;const v={image:"image",video:"video",audio:"audio","":"download"},b=e=>({id:a,value:s,change:i})=>t`
  <input id="${a}" type="text" class="full" .value="${s}" @input="${e=>i(e.target.value,!0)}">
  ${window.kempo?.openAssetPicker?t`<button class="mtq" @click="${async()=>{const t=await window.kempo.openAssetPicker({kind:e});t&&i(t.url,!1)}}"><k-icon name="${v[e]??"download"}"></k-icon> Choose from the media library</button>`:""}
`,$=({id:e,value:a,change:s})=>{const i=String(a??""),o=i.startsWith("src:")?i.slice(4):i?`/kempo-ui/icons/${i}.svg`:"";return t`<k-icon-picker id="${e}" .value="${o}" allow-none @change="${e=>s(e.detail.value?`src:${e.detail.value}`:"",!1)}"></k-icon-picker>`},w=e=>e.label||("default"===e.name?"Content":e.name[0].toUpperCase()+e.name.slice(1));export default class f extends e{static properties={data:{attribute:!1},host:{attribute:!1},meta:{attribute:!1},saving:{type:Boolean},ready:{state:!0},location:{state:!0},templates:{state:!0}};static styles=a`
    :host { display: block; height: 100%; }
    k-page-builder { height: 100%; }
  `;constructor(){super(),this.ready=!1,this.location="default",this.templates=[],this.saving=!1,this.trees={},this.savedJson="",this.loaded=null,this.sentPage=null,this.generation=0,this.shown=""}connectedCallback(){super.connectedCallback(),window.addEventListener("beforeunload",this.handleBeforeUnload),window.addEventListener("hashchange",this.handleHashChange)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("beforeunload",this.handleBeforeUnload),window.removeEventListener("hashchange",this.handleHashChange)}updated(e){super.updated(e),e.has("data")&&this.data&&this.data.trees!==this.loaded?.trees&&this.start(),this.show()}get dirty(){return JSON.stringify(this.trees)!==this.savedJson}getTrees(){return this.sentPage=structuredClone(this.renderRoot.querySelector("k-page-builder")?.value??null),structuredClone(this.trees)}markSaved(){this.savedJson=JSON.stringify(this.trees),this.renderRoot.querySelector("k-page-builder")?.markSaved(this.sentPage??void 0)}visualLocations(){return(this.data?.locations||[]).filter(e=>!e.code)}locationFromHash(){const e=this.visualLocations(),t=decodeURIComponent(window.location.hash.slice(1));return e.some(e=>e.name===t)?t:e[0]?.name||"default"}goTo(e){const t=e===this.visualLocations()[0]?.name?"":`#${encodeURIComponent(e)}`;window.history.pushState(null,"",`${window.location.pathname}${window.location.search}${t}`),this.location=e}async start(){this.loaded=this.data,this.generation++,await(g??=(async()=>{for(const e of[...c,...h])s.addWidget(e);s.addWidget({...s.widgets.find(e=>"html"===e.name),...p});const[,e]=await n();for(const t of e?.widgets||[])try{s.addWidget(t)}catch(e){console.warn(`The page widget "${t.name}" was not added: ${e.message}`)}i.pickers.image=b("image"),i.pickers.video=b("video"),i.pickers.audio=b("audio"),i.pickers.file=b(""),i.pickers.icon=$})(),g);const[,e]=await l();this.templates=e?.templates||[],m(this.data.page?.variables),this.trees=structuredClone(this.data.trees||{});for(const{name:e}of this.visualLocations())this.trees[e]=this.trees[e]||[];this.savedJson=JSON.stringify(this.trees),this.location=this.locationFromHash(),this.shown="",this.ready=!0}show(){const e=this.renderRoot.querySelector("k-page-builder"),t=`${this.generation}:${this.location}`;if(!e||!this.ready||this.shown===t)return;this.shown=t;const{title:a="",description:s=""}=this.meta||{};e.value={attrs:{title:a,description:s},slots:{default:structuredClone(this.trees[this.location]||[])}}}handleBeforeUnload=e=>{(this.dirty||this.host?.extrasDirty)&&(e.preventDefault(),e.returnValue="")};handleChange=e=>{const{value:t}=e.detail;this.trees[this.location]=structuredClone(t.slots?.default||[]);const{title:a="",description:s=""}=t.attrs||{};a===(this.meta?.title??"")&&s===(this.meta?.description??"")||this.host.setMeta({title:a,description:s})};handleSaveRequest=()=>this.host.save();handleLocation=e=>this.goTo(e.detail.value);handleHashChange=()=>{this.ready&&(this.location=this.locationFromHash())};handleTemplateSave=async e=>{const{name:t,nodes:a}=e.detail,[s,i]=await r({name:t,nodes:a});s?o.error(s.msg||"The template could not be saved"):this.templates=[i,...this.templates]};handleTemplateRemove=async e=>{const t=this.templates[e.detail.index];if(!t)return;const[a]=await d(t.id);a?o.error(a.msg||"The template could not be removed"):this.templates=this.templates.filter(e=>e!==t)};renderLocations(){const e=this.visualLocations();return e.length<2?"":t`<admin-pb-location slot="left-end" priority="8" .locations="${e.map(e=>({name:e.name,label:w(e)}))}" .value="${this.location}" @change="${this.handleLocation}"></admin-pb-location>`}renderPageSettings(){const e=this.host,a=e.page,s="system"===a.owner,i=this.meta,o=(e,a)=>t`<div class="mbq"><span class="tc-muted">${e}</span> ${a||""}</div>`;return t`
      <div slot="page-settings" class="mb">
        <div class="mb">
          <label class="d-b mbq" for="pb-page-name">Name<small class="d-b tc-muted">How the page is listed in the admin. Visitors never see it.</small></label>
          <input id="pb-page-name" type="text" class="full" .value="${i.name||""}" ?disabled="${s}" @input="${t=>e.setMeta({name:t.target.value})}">
        </div>
        <div class="mb">
          <label class="d-b mbq" for="pb-page-template">Template<small class="d-b tc-muted">The layout the page is drawn in. Changing it can change which content areas the page has.</small></label>
          <select id="pb-page-template" class="full" @change="${t=>e.setMeta({template:t.target.value})}">
            ${e.templateChoices().map(e=>t`<option value="${e.name}" .selected="${e.name===i.template}">${e.label}</option>`)}
          </select>
        </div>
        ${s?"":o("Author",a.author)}
        ${o("Owner",a.owner)}
        ${o("Created",a.createdAt?new Date(a.createdAt).toLocaleString():"")}
        ${o("Updated",a.updatedAt?new Date(a.updatedAt).toLocaleString():"")}
        ${Object.entries(a.extraMetadata||{}).map(([e,t])=>o(e,t))}
      </div>
    `}renderPageActions(){const e=this.host,a="system"===e.page?.owner,s=(this.data?.locations||[]).some(e=>e.code&&"head"===e.name),i=(e,a,s,i={})=>t`<admin-pb-control slot="right-start" priority="-1" icon="${e}" label="${a}" ?danger="${i.danger}" .action="${s}"></admin-pb-control>`;return t`
      ${s?i("code","Head code",()=>e.openCode("head")):""}
      ${i("content_copy","Copy page",e.handleCopy)}
      ${a?"":i("drive_file_move","Move page",e.handleMove)}
      ${a?"":i("repeat","Replace another page",e.handleReplace)}
      ${a?"":i("delete","Delete page",e.handleDelete,{danger:!0})}
    `}render(){if(!this.ready)return t`<div class="p">Loading the editor</div>`;const e=this.host;return t`
      <k-page-builder
        .templates="${this.templates.map(({name:e,nodes:t})=>({name:e,nodes:t}))}"
        .stylesheets="${u}"
        @change="${this.handleChange}"
        @saverequest="${this.handleSaveRequest}"
        @template-save="${this.handleTemplateSave}"
        @template-remove="${this.handleTemplateRemove}"
      >
        <admin-pb-control slot="left-end" priority="8" icon="arrow" direction="left" label="Back to the pages" href="/admin/content/pages"></admin-pb-control>
        <admin-pb-control slot="left-end" priority="8" icon="open_in_browser" label="Open the page in a new tab" href="${e.getPageUrl()}" target="_blank"></admin-pb-control>
        ${this.renderLocations()}
        ${this.renderPageActions()}
        ${this.renderPageSettings()}
      </k-page-builder>
    `}}customElements.define("admin-page-builder",f);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\admin\components\pagebuilder\PageBuilderEditor.js.map