import Component from"../Component.js";import{onEvent}from"../../utils/element.js";export default class PageSelect extends Component{constructor(e){super(),this.table=e,this.classList.add("mxq")}async render(){return!!await super.render()&&(this.updateOptions(),!0)}updateOptions(){const e=this.shadowRoot.getElementById("pageSelect");e.innerHTML="";for(let t=1;t<=this.table.getTotalPages();t++){const n=document.createElement("option");n.value=t,n.textContent=t,e.appendChild(n)}e.value=this.table.getCurrentPage();this.shadowRoot.getElementById("totalPages").textContent=this.table.getTotalPages(),onEvent(e,"change",(()=>{this.table.setPage(parseInt(e.value))})),onEvent(this.table,"pageSizeChange",(()=>{this.updateOptions()})),onEvent(this.table,"pageChange",(()=>{e.value=this.table.getCurrentPage()}))}get shadowTemplate(){return'\n      <select id="pageSelect" class="mxq"></select>\n      <label> out of <span id="totalPages"></span></label>\n    '}get shadowStyles(){return"\n      :host {\n        display: inline-flex;\n        width: max-content;\n        align-items: baseline;\n      }\n      #pageSelect, label {\n        display: inline;\n      }\n      label {\n        white-space: nowrap;\n      }\n    "}}window.customElements.define("k-table-page-select",PageSelect);