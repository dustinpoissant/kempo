import LazyComponent from"./LazyComponent.js";import"./Icon.js";import"./FocusCapture.js";import{onEvent,offEvent,dispatchEvent}from"../utils/element.js";export default class SideMenu extends LazyComponent{constructor(){super(),this.registerAttribute("opened",!1),this.registerAttribute("overlayClose",!0),this.registerProps({_overlayClick:()=>{this.overlayClose&&this.close()}})}disconnectedCallback(){super.disconnectedCallback(),offEvent(this.shadowRoot.getElementById("overlay"),"click",this._overlayClick)}attributeChangedCallback(n,e,t){super.attributeChangedCallback(n,e,t),"opened"===n&&dispatchEvent(this,"true"===t?"change open":"change close")}render(n){super.render(n),onEvent(this.shadowRoot.getElementById("overlay"),"click",this._overlayClick)}open(){this.opened=!0}close(){this.opened=!1}toggle(){this.opened?this.close():this.open(),dispatchEvent(this,"toggle")}get shadowTemplate(){return`\n      <k-focus-capture>\n        <div id="container">\n          <button id="overlay" class="no-btn">\n            <k-icon id="overlay-x" name="close"></k-icon>\n          </button>\n          <div id="menu">\n            ${super.shadowTemplate}\n          </div>\n        </div>\n      </k-focus-capture>\n    `}get shadowStyles(){return`\n      ${super.shadowStyles}\n      :host {\n        --bg: var(--c_bg);\n        --width: 20rem;\n\n        position: fixed;\n        top: 0;\n        left: 0;\n        width: 100vw;\n        max-width: 100%;\n        height: 100vh;\n        z-index: 100;\n        pointer-events: none;\n      }\n      :host([opened]) {\n        pointer-events: auto;\n      }\n      k-focus-capture {\n        width: 100%;\n        height: 100%;\n      }\n      #container {\n        position: relative;\n        width: 100%;\n        height: 100%;\n        opacity: 0;\n        transition: opacity var(--animation_ms, 256ms);\n      }\n      :host([opened]) #container {\n        opacity: 1;\n      }\n      #overlay {\n        position: absolute;\n        width: 100%;\n        height: 100%;\n        left: 0;\n        top: 0;\n        background: var(--overlay, rgba(0, 0, 0, 0.5));\n      }\n      #overlay-x {\n        position: absolute;\n        top: var(--spacer_h);\n        right: var(--spacer_h);\n        font-size: 1.75rem;\n        cursor: pointer;\n        color: var(--tc_light);\n      }\n      :host([overlay-close="false"]) #overlay-x {\n        display: none;\n      }\n      :host([overlay-close="false"]) #overlay {\n        cursor: default;\n      }\n      #menu {\n        position: absolute;\n        width: var(--width);\n        max-width: calc(100vw - 6rem);\n        height: 100vh;\n        overflow-y: auto;\n        left: calc(var(--width) * -1);\n        top: 0;\n        background: var(--bg);\n        transition: left var(--animation_ms, 256ms);\n        padding: var(--menu_padding, var(--spacer))\n      }\n      :host([opened]) #menu {\n        left: 0;\n      }\n      :host([side="right"]) #menu {\n        left: auto;\n        transition: right var(--animation_ms, 256ms);\n        right: calc(var(--width) * -1);\n      }\n      :host([opened][side="right"]) #menu {\n        right: 0;\n      }\n      :host([side="right"]) #overlay-x {\n        right: auto;\n        left: var(--spacer_h);\n      }\n    `}static get observedAttributes(){return["opened",...super.observedAttributes]}}window.customElements.define("k-side-menu",SideMenu);