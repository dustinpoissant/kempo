import TableControl from"./TableControl.js";import{onEvent,offEvent}from"../../utils/element.js";const clickHandler=Symbol("clickHandler"),handlePageChange=Symbol("handlePageChange");export default class FirstPage extends TableControl{constructor(){super(),this[clickHandler]=this.goToFirstPage.bind(this),this[handlePageChange]=(()=>{const e=this.table;e&&1!==e.getCurrentPage()?this.shadowRoot.getElementById("firstPage").disabled=!1:this.shadowRoot.getElementById("firstPage").disabled=!0}).bind(this)}async render(e=!1){return!!await super.render(e)&&(onEvent(this.shadowRoot.getElementById("firstPage"),"click",this[clickHandler]),this[handlePageChange](),onEvent(this.table,"pageChange",this[handlePageChange]),!0)}disconnectedCallback(){super.disconnectedCallback(),offEvent(this.shadowRoot.getElementById("firstPage"),"click",this[clickHandler]),offEvent(this.table,"pageChange",this[handlePageChange])}goToFirstPage(){const e=this.table;e&&e.firstPage()}get shadowTemplate(){return'\n      <button\n        id="firstPage"\n        class="no-btn icon-btn"\n      >\n        <slot><k-icon name="first"></k-icon></slot>\n      </button>\n    '}get shadowStyles(){return`\n      ${super.shadowStyles}\n      #firstPage[disabled] {\n        cursor: inherit;\n        opacity: 0.5;\n      }\n    `}}window.customElements.define("k-tc-first-page",FirstPage);