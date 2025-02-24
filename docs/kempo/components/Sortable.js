import Component from"./Component.js";import{onEvent,offEvent,dispatchEvent}from"../utils/element.js";import drag from"../utils/drag.js";const dragStartHandler=Symbol("dragStartHandler"),dragMoveHandler=Symbol("dragMoveHandler"),dragEndHandler=Symbol("dragEndHandler"),cleanup=Symbol("cleanup");export class Sortable extends Component{constructor(){super(),this.registerAttributes({sorting:!1})}async render(t){return await super.render(t),!1}disconnectedCallback(){super.disconnectedCallback(),this.cleanupFuncs.forEach((t=>t()))}getCursorElement(){const t=Array.from(this.children).filter((t=>"K-SORTABLE-ITEM"===t.tagName&&!t.hasAttribute("sorting")));if(0===t.length)return null;const e=event.clientY;if(e<t[0].getBoundingClientRect().top)return[t[0],"before"];if(e>t[t.length-1].getBoundingClientRect().bottom)return[t[t.length-1],"after"];for(const r of t){const t=r.getBoundingClientRect();if(e<t.top+t.height/2)return[r,"before"];if(e<t.bottom)return[r,"after"]}return null}}window.customElements.define("k-sortable",Sortable);export class SortableItem extends Component{constructor(){super(),this[dragStartHandler]=()=>{this.sorting=!0},this[dragMoveHandler]=({y:t})=>{this.style.transform=`translateY(${t}px)`,this.style.zIndex=9999;const[e,r]=this.sortable.getCursorElement();Array.from(this.sortable.children).forEach((t=>{t.classList.remove("target-before","target-after")})),e&&e.classList.add(`target-${r}`)},this[dragEndHandler]=({y:t})=>{this.sorting=!1,this.style.transform="",this.style.zIndex="";const[e,r]=this.sortable.getCursorElement();Array.from(this.sortable.children).forEach((t=>{t.classList.remove("target-before","target-after")})),e&&("before"===r?this.sortable.insertBefore(this,e):"after"===r&&this.sortable.insertBefore(this,e.nextSibling),dispatchEvent(this.sortable,"sort"))},this.registerAttributes({sorting:!1})}async render(t=!1){if(await super.render(t)){const t=this.shadowRoot.getElementById("handle");return this[cleanup]=drag({element:t,startCallback:this[dragStartHandler],moveCallback:this[dragMoveHandler],endCallback:this[dragEndHandler]}),!0}return!1}get sortable(){return this.closest("k-sortable")}get shadowTemplate(){return`\n      <div id="handle">\n        <k-icon name="drag-handle"></k-icon>\n      </div>\n      <div id="content" class="p pl0">\n        ${super.shadowTemplate}\n      </div>\n    `}get shadowStyles(){return`\n      ${super.shadowStyles}\n      :host {\n        display: block;\n        border: 1px solid var(--c_border);\n        user-select: none;\n        position: relative;\n      }\n      :host([sorting]){\n       opacity: 0.8;\n      }\n      #handle {\n        display: inline-block;\n        cursor: pointer;\n        padding: var(--spacer);\n      }\n      #content {\n      display: inline-block;\n      }\n      :host(.target-before)::before,\n      :host(.target-after)::after {\n        content: '';\n        position: absolute;\n        left: 0;\n        right: 0;\n        height: 4px;\n        background-color: var(--c_primary);\n      }\n      :host(.target-before)::before {\n        top: -2px;\n      }\n      :host(.target-after)::after {\n        bottom: -2px;\n      }\n    `}}window.customElements.define("k-sortable-item",SortableItem);