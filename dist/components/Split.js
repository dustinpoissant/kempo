import Component from"./Component.js";import drag from"../utils/drag.js";import{dispatchEvent}from"../utils/element.js";import{watchWindowSize,unwatchWindowSize}from"../utils/watchWindowSize.js";const dragStartWidth=Symbol(),dragStartCallback=Symbol(),dragEndCallback=Symbol(),dragCallback=Symbol(),dragCleanup=Symbol(),windowResizeHandler=Symbol();export default class Split extends Component{constructor({stackWidth:t=0}={}){super(),this[dragStartWidth]=0,this[dragStartCallback]=()=>{this.resizing=!0,this[dragStartWidth]=Math.round(this.shadowRoot.getElementById("left").getBoundingClientRect().width),dispatchEvent(this,"resizestart",{startSize:this[dragStartWidth]})},this[dragCallback]=({x:t})=>{const e=`${this[dragStartWidth]+t}px`;this.setSize(e),dispatchEvent(this,"resize",{size:e})},this[dragEndCallback]=({x:t})=>{this.resizing=!1;const e=`${this[dragStartWidth]+t}px`;this.setSize(e),dispatchEvent(this,"resizeend",{size:e})},this[dragCleanup]=()=>{},this[windowResizeHandler]=t=>{this.stacked=t<=this.stackWidth},this.registerAttributes({resizing:!1,stacked:!1,stackWidth:t})}disconnectedCallback(){super.disconnectedCallback(),this[dragCleanup]()}async render(t){return!!await super.render(t)&&(this[dragCleanup]=drag({element:this.shadowRoot.getElementById("divider-handle"),callback:this[dragCallback],startCallback:this[dragStartCallback],endCallback:this[dragEndCallback]}),this.stacked=watchWindowSize(this[windowResizeHandler])<=this.stackWidth,!0)}setSize(t){this.style.setProperty("--left_width",t)}get shadowTemplate(){return`\n      <div\n        id="left"\n        class="pane"\n      >\n        ${super.shadowTemplate}\n      </div>\n      <div id="divider-handle">\n        <div id="divider-border"></div>\n      </div>\n      <div\n        id="right"\n        class="pane"\n      >\n        <slot name="right"></slot>\n      </div>\n    `}get shadowStyles(){return`\n      ${super.shadowStyles}\n      :host {\n        --left_width: calc( (100% - var(--handle_width)) / 2);\n        --handle_width: 0.5rem;\n        --min_pane_width: 6rem;\n\n        height: 100%;\n        display: flex;\n        align-items: stretch;\n        flex: 1 1 auto;\n        overflow: hidden;\n      }\n      .pane, #divider-handle {\n        display: inline-block;\n      }\n      .pane {\n        min-width: var(--min_pane_width);\n        max-width: calc(100% - var(--min_pane_width));\n        max-height: 100%;\n        overflow: hidden;\n      }\n      #left {\n        flex: 0 0 var(--left_width);\n      }\n      #divider-handle {\n        display: flex;\n        justify-content: center;\n        width: var(--handle_width);\n        cursor: ew-resize;\n      }\n      :host([resizing]) #divider-handle {\n        background-color: var(--tc_primary);\n      }\n      :host([resizing]) .pane {\n        pointer-events: none;\n        user-select: none;\n      }\n      #divider-border {\n        width: 1px;\n        height: 100%;\n        border-left: 1px solid var(--c_border);\n      }\n      #right {\n        flex: 1 1;\n      }\n      :host([stacked="true"]),\n      :host([stacked="true"]) #left,\n      :host([stacked="true"]) #right {\n        display: block;\n      }\n      :host([stacked="true"]) #divider-handle {\n          display: none;\n        } \n    `}}window.customElements.define("k-split",Split);