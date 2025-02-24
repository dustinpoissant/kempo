import TableControl from"./TableControl.js";import{onEvent}from"../../utils/element.js";const updateOptions=Symbol("updateOptions"),handleSelectChange=Symbol("handleSelectChange"),handlePageSizeChange=Symbol("handlePageSizeChange"),handlePageChange=Symbol("handlePageChange"),handlePageCountChange=Symbol("handlePageCountChange");export default class PageSelect extends TableControl{constructor(){super(),this[updateOptions]=(()=>{const e=this.shadowRoot.getElementById("pageSelect");e.innerHTML="";for(let t=1;t<=this.table.getTotalPages();t++){const a=document.createElement("option");a.value=t,a.textContent=t,e.appendChild(a)}e.value=this.table.getCurrentPage(),this.shadowRoot.getElementById("totalPages").textContent=this.table.getTotalPages()}).bind(this),this[handleSelectChange]=(()=>{this.table.setPage(parseInt(this.shadowRoot.getElementById("pageSelect").value))}).bind(this),this[handlePageSizeChange]=(()=>{this[updateOptions](),this.shadowRoot.getElementById("pageSelect").value=this.table.getCurrentPage()}).bind(this),this[handlePageChange]=(()=>{this.shadowRoot.getElementById("pageSelect").value=this.table.getCurrentPage()}).bind(this),this[handlePageCountChange]=(()=>{this.shadowRoot.getElementById("totalPages").textContent=this.table.getTotalPages(),this[updateOptions]()}).bind(this)}async render(e=!1){if(await super.render(e)){const e=this.shadowRoot.getElementById("pageSelect");return onEvent(e,"change",this[handleSelectChange]),onEvent(this.table,"pageSizeChange",this[handlePageSizeChange]),onEvent(this.table,"pageChange pageCountChanged",this[handlePageChange]),onEvent(this.table,"pageCountChanged",this[handlePageCountChange]),this[updateOptions](),!0}return!1}disconnectedCallback(){super.disconnectedCallback(),offEvent(this.shadowRoot.getElementById("pageSelect"),"change",this[handleSelectChange]),offEvent(this.table,"pageSizeChange",this[handlePageSizeChange]),offEvent(this.table,"pageChange pageCountChanged",this[handlePageChange]),offEvent(this.table,"pageCountChanged",this[handlePageCountChange])}get shadowTemplate(){return'\n      <select id="pageSelect" class="mxq"></select>\n      <label> out of <span id="totalPages"></span></label>\n    '}get shadowStyles(){return"\n      :host {\n        display: inline-flex;\n        width: max-content;\n        align-items: baseline;\n      }\n      #pageSelect, label {\n        display: inline;\n      }\n      label {\n        white-space: nowrap;\n      }\n    "}}window.customElements.define("k-tc-page-select",PageSelect);