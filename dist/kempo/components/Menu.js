import LightComponent from"/kempo-ui/components/LightComponent.js";import{html}from"/kempo-ui/lit-all.min.js";import{getMenuBySlug}from"../sdk.js";export default class Menu extends LightComponent{static get properties(){return{slug:{type:String,reflect:!0},loaded:{type:Boolean,state:!0},menuData:{state:!0}}}constructor(){super(),this.loaded=!1,this.menuData=null}async connectedCallback(){super.connectedCallback(),await this.fetchMenu()}fetchMenu=async()=>{if(!this.slug)return void(this.loaded=!0);const[e,t]=await getMenuBySlug(this.slug);if(e)return console.error(`<k-menu slug="${this.slug}">:`,e.msg),void(this.loaded=!0);this.menuData=t,this.loaded=!0};updated(e){super.updated(e)}renderItem(e){const t=e.url||"#",n="#"!==t&&window.location.pathname===t,a="_blank"===e.target?"_blank":"_self";return html`
      <li>
        <a
          href="${t}"
          ?class="${n}"
          target="${a}"
          rel="${"_blank"===a?"noopener noreferrer":""}"
          class="${n?"active":""}"
        >${e.label}</a>
        ${e.children?.length?html`<ul>${e.children.map(e=>this.renderItem(e))}</ul>`:""}
      </li>
    `}renderLightDom(){return this.loaded&&this.menuData?html`
      <nav class="k-menu" data-slug="${this.slug}">
        <ul>${this.menuData.items.map(e=>this.renderItem(e))}</ul>
      </nav>
    `:html``}}customElements.define("k-menu",Menu);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\kempo\components\Menu.js.map