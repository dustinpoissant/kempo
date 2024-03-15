import ReactiveLazyComponent from"./ReactiveLazyComponent.js";import{onEvent,offEvent,dispatchEvent}from"../utils/element.js";const toggleClickHandler=Symbol("toggleClickHandler");export default class Collapse extends ReactiveLazyComponent{constructor(){super(),this[toggleClickHandler]=()=>{this.toggle(),this.shadowRoot.getElementById("toggle").focus()},this.registerAttribute("opened",!1)}async render(e){return!!super.render(e)&&(onEvent(this.shadowRoot.getElementById("toggle"),"click",this[toggleClickHandler]),!0)}disconnectedCallback(){offEvent(this.shadowRoot.getElementById("toggle"),"click",this[toggleClickHandler]),super.disconnectedCallback()}attributeChangedCallback(e,t,n){super.attributeChangedCallback(e,t,n),"opened"===e&&dispatchEvent(this,n?"change opened":"change closed")}open(){this.opened=!0}close(){this.opened=!1}toggle(){this.opened=!this.opened,dispatchEvent(this,"toggle")}get shadowTemplate(){return`\n      <button\n        id="toggle"\n        class="no-btn p"\n      >\n        <slot name="${this.opened?"closeText":"openText"}">${this.opened?"Hide Content":"Show Content"}</slot>\n      </button>\n      ${this.renderIf(this.opened,`\n        <div id="content">\n          ${super.shadowTemplate}\n        </div>\n      `)}\n    `}get shadowStyles(){return`\n      ${super.shadowStyles}\n      :host {\n        display: block;\n      }\n      #toggle {\n        width: 100%;\n      }\n    `}static renderOnChange=["opened"];static observedAttributes=this.renderOnChange}window.customElements.define("k-collapse",Collapse);