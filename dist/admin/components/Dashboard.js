import t from"/kempo-ui/components/LightComponent.js";import{html as e,nothing as i,repeat as s,keyed as a}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Icon.js";import"/kempo-ui/components/Dialog.js";import"/kempo-ui/components/Sortable.js";import{getDashboardWidgets as n}from"/kempo/sdk.js";import{resolveLayout as o,serializeLayout as l,reorder as r,readStored as d,writeStored as h,clearStored as c}from"./dashboardLayout.js";const m="min(32rem, 70vw)",u=(t,e)=>Array.from({length:e-t+1},(e,i)=>t+i);export default class p extends t{static properties={heading:{type:String},layout:{state:!0},draft:{state:!0},sortVersion:{state:!0},columns:{state:!0},loading:{state:!0},failure:{state:!0},failures:{state:!0}};#t=[];#e=[];#i=!1;#s=new Map;#a=new Set;#n=null;constructor(){super(),this.heading="",this.layout=[],this.draft=[],this.sortVersion=0,this.columns=4,this.loading=!0,this.failure="",this.failures={}}connectedCallback(){super.connectedCallback(),this.classList.add("d-b"),this.#n=new ResizeObserver(([t])=>{const{width:e}=t.contentRect,i=e>=880?4:e>=560?2:1;i!==this.columns&&(this.columns=i)}),this.#n.observe(this),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.#n?.disconnect()}updated(t){super.updated(t),this.layout.forEach(({widget:t,visible:e,width:i,height:s})=>{const a=this.#s.get(t.id);e&&a&&(a.width=Math.min(i,this.columns),a.height=s)})}load=async()=>{const[t,e]=await n();this.loading=!1,t?this.failure=`Could not load the dashboard: ${t.msg}`:(this.failure="",this.#t=e.widgets,this.#e=e.unavailable??[],this.layout=o(this.#t,d()),this.mountVisible())};mount=async({widget:t})=>{if(!this.#s.has(t.id)&&!this.#a.has(t.id)){this.#a.add(t.id);try{if(await(import(t.module)),!customElements.get(t.element))throw new Error(`${t.module} did not define <${t.element}>`);const e=document.createElement(t.element);e.definition=t,this.#s.set(t.id,e)}catch(e){this.failures={...this.failures,[t.id]:`is not available: its script ${t.module} could not be loaded, which usually means the extension that provides it needs updating.`},console.error(`Dashboard widget ${t.id} failed to load:`,e)}this.#a.delete(t.id),this.requestUpdate()}};mountVisible=()=>this.layout.filter(({visible:t})=>t).forEach(this.mount);commit=t=>{const e=l(t,{stored:this.#i?null:d(),unavailable:this.#e});this.layout=t,JSON.stringify(e)===JSON.stringify(l(o(this.#t,null)))?c():h(e),t.filter(({visible:t})=>!t).forEach(({widget:t})=>{if(this.#s.delete(t.id),this.failures[t.id]){const{[t.id]:e,...i}=this.failures;this.failures=i}}),this.mountVisible()};openCustomize=()=>{this.#i=!1,this.draft=this.layout.map(t=>({...t})),this.sortVersion++,this.querySelector("k-dialog").open()};save=()=>this.commit(this.draft);resetDraft=()=>{this.#i=!0,this.draft=o(this.#t,null),this.sortVersion++};changeDraft=(t,e)=>{this.draft=this.draft.map(i=>i.widget.id===t?{...i,...e}:i)};handleSort=t=>{this.draft=r(this.draft,[...t.currentTarget.children].map(t=>t.dataset.widgetId)),this.sortVersion++};renderDraftRow=({widget:t,visible:s,width:a,height:n})=>e`
    <k-sortable-item class="mbh" data-widget-id=${t.id}>
      <div style="display: flex; flex-wrap: nowrap; align-items: center; gap: var(--spacer); width: ${m}; min-height: 3.5rem;">
        <div class="flex" style="display: flex; flex-wrap: nowrap; align-items: center; gap: var(--spacer_h); min-width: 0;">
          ${t.iconSrc?e`<k-icon class=${s?"":"tc-muted"} src=${t.iconSrc}></k-icon>`:t.icon?e`<k-icon class=${s?"":"tc-muted"} name=${t.icon}></k-icon>`:i}
          <strong class=${s?"":"tc-muted"}>${t.title}</strong>
        </div>
        <select style="width: 4.5rem;" aria-label="${t.title} width" ?disabled=${!s} @change=${e=>this.changeDraft(t.id,{width:Number(e.target.value)})}>
          ${u(t.minWidth,t.maxWidth).map(t=>e`<option value=${t} ?selected=${t===a}>${t}</option>`)}
        </select>
        <select style="width: 4.5rem;" aria-label="${t.title} height" ?disabled=${!s} @change=${e=>this.changeDraft(t.id,{height:Number(e.target.value)})}>
          ${u(t.minHeight,t.maxHeight).map(t=>e`<option value=${t} ?selected=${t===n}>${t}</option>`)}
        </select>
        <button
          class="no-btn pq"
          style="width: 2.5rem;"
          title=${s?"Hide":"Show"}
          aria-label="${s?"Hide":"Show"} ${t.title}"
          @click=${()=>this.changeDraft(t.id,{visible:!s})}
        ><k-icon name=${s?"hide":"show"}></k-icon></button>
      </div>
    </k-sortable-item>
  `;renderDraftHeader=()=>e`
    <div class="small tc-muted mbh" style="display: flex; flex-wrap: nowrap; gap: var(--spacer); width: calc(${m} + 3.7rem); padding-left: 3.7rem;">
      <span class="flex">Widget</span>
      <span style="width: 4.5rem;">Width</span>
      <span style="width: 4.5rem;">Height</span>
      <span style="width: 2.5rem;"></span>
    </div>
  `;renderCustomizeDialog=()=>e`
    <k-dialog
      confirm-text="Save"
      confirm-classes="primary ml"
      cancel-text="Cancel"
      .confirmAction=${this.save}
    >
      <h5 slot="title" class="pyh px m0">Customize dashboard</h5>
      <div class="p">
        <p class="small tc-muted">Drag to reorder. Hidden widgets are not loaded. Sizes are in blocks; the dashboard is four blocks wide.</p>
        ${this.renderDraftHeader()}
        ${a(this.sortVersion,e`
          <k-sortable @sort=${this.handleSort}>${this.draft.map(this.renderDraftRow)}</k-sortable>
        `)}
        <button class="mt" @click=${this.resetDraft}><k-icon name="restart_alt"></k-icon> Reset to defaults</button>
      </div>
    </k-dialog>
  `;renderCell=({widget:t,width:i,height:s})=>{const a=this.#s.get(t.id),n=this.failures[t.id];return e`
      <div
        data-widget-id=${t.id}
        style="grid-column: span ${Math.min(i,this.columns)}; grid-row: span ${s}; min-width: 0;"
      >
        <section class="b r" style="height: 100%; min-height: 0; overflow: hidden;">
          ${n?e`<p class="p tc-danger" role="alert"><strong>${t.title}</strong> ${n}</p>`:a??e`<p class="p tc-muted"><strong>${t.title}</strong> Loading&hellip;</p>`}
        </section>
      </div>
    `};renderLightDom(){if(this.failure)return e`<p class="tc-danger" role="alert">${this.failure}</p>`;if(this.loading)return e`<p class="tc-muted">Loading&hellip;</p>`;const t=this.layout.filter(t=>t.visible);return e`
      <div class="d-f mb" style="align-items: center;">
        <h1 class="flex m0">${this.heading}</h1>
        <button @click=${this.openCustomize}><k-icon name="edit"></k-icon> Customize</button>
      </div>
      ${t.length?i:e`<p class="tc-muted">No widgets are shown. Choose Customize to add some.</p>`}
      <div class="d-g" style="grid-template-columns: repeat(${this.columns}, minmax(0, 1fr)); grid-auto-rows: 14rem; grid-auto-flow: dense; gap: var(--spacer);">
        ${s(t,t=>t.widget.id,this.renderCell)}
      </div>
      ${this.renderCustomizeDialog()}
    `}}customElements.define("k-dashboard",p);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\admin\components\Dashboard.js.map