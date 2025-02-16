import Component from"../Component.js";import{onEvent}from"../../utils/element.js";export default class DeleteSelected extends Component{constructor(e){super(),this.table=e,this.classList.add("mxq")}async render(){if(await super.render()){this.updateButtonState();const e=this.shadowRoot.getElementById("deleteSelectedButton");return onEvent(e,"click",(()=>this.deleteSelected())),onEvent(this.table,"selectionChange",(()=>this.updateButtonState())),!0}return!1}deleteSelected(){this.table.deleteSelected(),this.updateButtonState()}updateButtonState(){this.shadowRoot.getElementById("deleteSelectedButton").disabled=0===this.table.getSelectedRecords().length}get shadowTemplate(){return'\n      <button id="deleteSelectedButton" class="pq no-btn">\n        <k-icon name="delete"></k-icon>\n      </button>\n    '}get shadowStyles(){return"\n      :host {\n        display: inline-flex;\n        width: max-content;\n        align-items: baseline;\n      }\n      button {\n        display: flex;\n        align-items: center;\n      }\n    "}}window.customElements.define("k-table-delete-selected",DeleteSelected);