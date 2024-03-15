import{getCase}from"../utils/string.js";export default class Component extends HTMLElement{constructor(t={}){super(),this.attachShadow({mode:"open",...t}),this.registerAttribute("rendered",!1)}async connectedCallback(){this.render()}async disconnectedCallback(){}async attributeChangedCallback(){}async propChangedCallback(){}async render(t=!1){if(t||!this.rendered)return this.shadowRoot.innerHTML=`<link rel="stylesheet" href="../kempo/kempo.css" />${this.shadowTemplate}<style>${this.shadowStyles}</style>`,this.rendered=!0,!0}registerAttribute(t,e=""){const{camel:s,dash:r}=getCase(t),i=typeof e;Object.defineProperty(this,s,{get:()=>{const t=this.getAttribute(r);return"number"==i?parseFloat(t):"object"===i?"string"==typeof t?JSON.parse(t):t:"boolean"===i?"string"==typeof t?"true"===t.toLowerCase().trim():!!t:"string"===i?t||"":t},set:t=>{this[r]!==t&&("boolean"===i?t?this.setAttribute(r,"true"):this.removeAttribute(r):"object"===i?this.setAttribute(r,JSON.stringify(t||{})):"number"===i?t||0===t?this.setAttribute(r,t):this.removeAttribute(r):this.setAttribute(r,t))}}),null===this.getAttribute(r)&&(this[s]=e)}registerAttributes(t){for(const e in t)this.registerAttribute(e,t[e])}registerProp(t,e){const s=Symbol(t);this[s]=e,Object.defineProperty(this,t,{get:()=>this[s],set:e=>{if(this[s]!==e){const r=this[s];this[s]=e,this.propChangedCallback(t,r,e)}}})}registerProps(t){for(const e in t)this.registerProp(e,t[e])}renderIf(t,e){return t?e:""}get shadowTemplate(){return"\n      <slot></slot>\n    "}get shadowStyles(){return""}static observedAttributes=["rendered"]}window.customElements.define("k-component",Component);