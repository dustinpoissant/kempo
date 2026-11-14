import e from"/kempo-ui/components/ShadowComponent.js";import{html as t,css as s,nothing as i}from"/kempo-ui/lit-all.min.js";import"/kempo-ui/components/Icon.js";import a from"/kempo-ui/components/Dialog.js";let o=null;class n extends e{static properties={value:{type:String},icons:{state:!0},sources:{state:!0},query:{state:!0},pending:{state:!0},error:{state:!0}};static styles=s`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
      gap: var(--spacer_h);
    }
    .grid .icon-option {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--spacer_h);
      font-size: 1.25rem;
      color: var(--tc);
      transition: background var(--animation_ms);
    }
    .grid .icon-option:hover:not(.bg-primary) {
      background: var(--c_bg__alt);
    }
    .grid .icon-option.bg-primary {
      color: var(--tc_light);
    }
  `;constructor(){super(),this.value="",this.icons=null,this.sources=[],this.query="",this.pending="",this.error=""}connectedCallback(){super.connectedCallback(),(async()=>{if(!o){const e=await fetch("/kempo/api/icons");if(!e.ok)throw new Error(`The icons could not be loaded (${e.status})`);o=await e.json()}return o})().then(e=>{this.icons=e.icons,this.sources=e.sources}).catch(e=>{this.error=e.message})}willUpdate(e){e.has("value")&&(this.pending=this.value)}search=e=>{this.query=e.target.value};pick=e=>{this.pending=e.src};get chosen(){return{value:this.pending,label:this.icons?.find(e=>e.src===this.pending)?.label??""}}groups(){const e=this.query.trim().toLowerCase();return this.sources.map(t=>({...t,icons:(this.icons??[]).filter(s=>s.source===t.id&&(!e||s.label.toLowerCase().includes(e)||s.name.toLowerCase().includes(e)))})).filter(e=>e.icons.length)}render(){if(this.error)return t`<div class="p"><p class="tc-danger" role="alert">${this.error}</p></div>`;if(!this.icons)return t`<div class="p"><p class="tc-muted">Loading the icons</p></div>`;const e=this.groups();return t`
      <div class="p">
        <input type="search" class="full mb" placeholder="Filter icons..." aria-label="Filter icons" autocomplete="off" .value=${this.query} @input=${this.search}>
        ${e.length?e.map(e=>t`
          <h6 class="mtq mbq">${e.label}</h6>
          <div class="grid">
            ${e.icons.map(e=>t`
              <button type="button" class="no-btn icon-option r${e.src===this.pending?" bg-primary":""}" title="${e.label}" aria-label="${e.label}" aria-pressed=${e.src===this.pending} @click=${()=>this.pick(e)}>
                <k-icon src=${e.src}></k-icon>
              </button>`)}
          </div>`):t`<p class="tc-muted">No icons match</p>`}
      </div>
    `}}customElements.define("k-icon-browser",n);export default class l extends e{static formAssociated=!0;static properties={value:{type:String,reflect:!0},name:{type:String,reflect:!0},placeholder:{type:String},allowNone:{type:Boolean,attribute:"allow-none"},disabled:{type:Boolean,reflect:!0}};static styles=s`
    .current {
      display: flex;
      align-items: center;
      gap: var(--spacer_q);
    }
  `;constructor(){super(),this.internals=this.attachInternals(),this.value="",this.name="",this.placeholder="Choose an icon",this.allowNone=!1,this.disabled=!1,this.dialog=null}connectedCallback(){super.connectedCallback(),this.internals.setFormValue(this.value)}disconnectedCallback(){this.dialog?.close(),super.disconnectedCallback()}willUpdate(e){e.has("value")&&this.internals.setFormValue(this.value)}open=()=>{if(this.dialog)return;const e=document.createElement("k-icon-browser");e.value=this.value,this.dialog=a.create(e,{title:"Choose an Icon",width:"32rem",cancelText:this.allowNone?"Clear":"Cancel",confirmText:"Choose Icon",cancelAction:()=>{this.allowNone&&this.choose({value:"",label:""})},confirmAction:()=>this.choose(e.chosen),closeCallback:()=>{this.dialog=null}})};choose=({value:e,label:t})=>{e!==this.value&&(this.value=e,this.dispatchEvent(new CustomEvent("change",{bubbles:!0,detail:{value:e,label:t}})))};currentLabel(){return this.value?(e=>{const t=e.replace(/[-_]+/g," ");return t.charAt(0).toUpperCase()+t.slice(1)})(this.value.split("/").pop().replace(/\.svg$/,"")):this.allowNone?"No icon":this.placeholder}render(){return t`
      <button type="button" class="full" ?disabled=${this.disabled} @click=${this.open}>
        <span class="current">${this.value?t`<k-icon src=${this.value}></k-icon>`:i}${this.currentLabel()}</span>
      </button>
    `}}customElements.define("k-icon-picker",l);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\kempo\components\IconPicker.js.map