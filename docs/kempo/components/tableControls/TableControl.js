import Component from"../Component.js";export default class TableControl extends Component{constructor({maxWidth:t=40}={}){super(),this.registerAttributes({maxWidth:t})}get table(){return this.getRootNode()instanceof ShadowRoot?this.getRootNode().host.closest("k-table"):this.closest("k-table")}get record(){if(this.getRootNode()instanceof ShadowRoot){const t=this.closest(".record");if(t){const e=t.dataset.index;if(e)return this.table.records[e]}}return!1}get shadowStyles(){return`\n      ${super.shadowStyles}\n      :host {\n        display: inline-flex;\n      }\n      .icon-btn {\n        display: inline-flex !important;\n        align-items: center;\n        justify-content: center;\n        width: 40px;\n        height: 40px;\n      }\n    `}}