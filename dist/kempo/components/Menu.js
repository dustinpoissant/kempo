import e from"/kempo-ui/components/LightComponent.js";import{html as t}from"/kempo-ui/lit-all.min.js";import{getMenuBySlug as a}from"../sdk.js";export default class s extends e{static get properties(){return{slug:{type:String,reflect:!0},loaded:{type:Boolean,state:!0},menuData:{state:!0}}}constructor(){super(),this.loaded=!1,this.menuData=null}async connectedCallback(){super.connectedCallback(),await this.fetchMenu()}fetchMenu=async()=>{if(!this.slug)return void(this.loaded=!0);const[e,t]=await a(this.slug);if(e)return console.error(`<k-menu slug="${this.slug}">:`,e.msg),void(this.loaded=!0);this.menuData=t,this.loaded=!0};updated(e){super.updated(e)}renderItem(e){const a=e.url||"#",s="#"!==a&&window.location.pathname===a,n="_blank"===e.target?"_blank":"_self";return t`
      <li>
        <a
          href="${a}"
          ?class="${s}"
          target="${n}"
          rel="${"_blank"===n?"noopener noreferrer":""}"
          class="${s?"active":""}"
        >${e.label}</a>
        ${e.children?.length?t`<ul>${e.children.map(e=>this.renderItem(e))}</ul>`:""}
      </li>
    `}renderLightDom(){return this.loaded&&this.menuData?t`
      <nav class="k-menu" data-slug="${this.slug}">
        <ul>${this.menuData.items.map(e=>this.renderItem(e))}</ul>
      </nav>
    `:t``}}customElements.define("k-menu",s);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\kempo\components\Menu.js.map