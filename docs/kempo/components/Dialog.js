import Component from"./Component.js";import"./FocusCapture.js";import"./Icon.js";import{firstFocusable,onEvent,offEvent,dispatchEvent}from"../utils/element.js";export default class Dialog extends Component{constructor({opened:n=!1,closeBtn:e=!0,overlayClose:t=!0,confirmText:o="",confirmClasses:i="success ml",confirmAction:s=(()=>{}),cancelText:a="",cancelClasses:c="",cancelAction:l=(()=>{}),closeCallback:r=(()=>{})}={}){super(),this.registerAttributes({opened:n,closeBtn:e,overlayClose:t,confirmText:o,confirmClasses:i,cancelText:a,cancelClasses:c}),this.registerProps({confirmAction:s,cancelAction:l,closeCallback:r,previousFocus:null,_clickHandler:n=>{const{target:{id:e}}=n;"overlay"==e&&this.overlayClose||"close"==e?this.close():"cancel"==e?(this.cancelAction(n),n.defaultPrevented||this.close()):"confirm"==e&&(this.confirmAction(n),n.defaultPrevented||this.close())},_keydownHandler:({keyCode:n})=>{27===n&&this.close()},_hasTitle:()=>!!this.querySelector('[slot="title"]')})}connectedCallback(){super.connectedCallback(),onEvent(this.shadowRoot,"click",this._clickHandler)}disconnectedCallback(){super.connectedCallback(),offEvent(this.shadowRoot,"click",this._clickHandler),offEvent(window,"keydown",this._keydownHandler)}attributeChangedCallback(n,e,t){super.attributeChangedCallback(n,e,t),"opened"===name&&dispatchEvent(this,t?"opened":"closed")}open(){this.opened=!0;const n=this.shadowRoot.querySelector("[autofocus]")||firstFocusable(this.shadowRoot);n&&n.focus(),onEvent(window,"keydown",this._keydownHandler)}close(){this.opened=!1,this.blur(),this.closeCallback(),offEvent(window,"keydown",this._keydownHandler)}toggle(){this.opened?this.close():this.open()}focus(){const n=firstFocusable(this.shadowRoot);n&&(this.previousFocus=document.activeElement,n.focus())}blur(){this.previousFocus&&this.previousFocus.focus()}get shadowTemplate(){return`\n      <k-focus-capture>\n        <button id="overlay" aria-label="Close the Dialog"></button>\n        <div id="wrapper">\n          <div\n            id="dialog"\n            role="dialog"\n            aria-modal="true"\n            aria-labelledby="title"\n          >\n            <div\n              id="header"\n              class="${this._hasTitle()?"has-title":""}"\n            >\n              <div\n                id="title"\n              ><slot name="title"></slot></div>\n              ${this.renderIf(this.closeBtn,'\n                <button\n                  id="close"\n                >\n                  <k-icon name="close"></k-icon>\n                </button>\n              ')}\n            </div>\n            <div id="body">\n              ${super.shadowTemplate}\n            </div>\n            ${this.renderIf(this.cancelText||this.confirmText,`\n              <div id="footer">\n                ${this.renderIf(this.cancelText,`\n                  <button id="cancel" class="${this.cancelClasses}">\n                    ${this.cancelText}\n                  </button>\n                `)}\n                ${this.renderIf(this.confirmText,`\n                  <button id="confirm" class="${this.confirmClasses}">\n                    ${this.confirmText}\n                  </button>\n                `)}\n              </div>\n            `)}\n          </div>\n        </div>\n      </k-focus-capture>\n    `}get shadowStyles(){return`\n      ${super.shadowStyles}\n      :host {\n        display: inline;\n        height: 0;\n        width: 0;\n      }\n      :host(:not([opened])){\n        display: none;\n      }\n      #overlay {\n        position: fixed;\n        width: 100vw;\n        height: 100vh;\n        top: 0;\n        left: 0;\n        background-color: var(--c_overlay);\n        z-index: 100;\n        border: 0px solid transparent;\n        box-shadow: 0 0 0 transparent;\n      }\n      #wrapper {\n        display: flex;\n        justify-content: center;\n        align-items: center;\n        position: fixed;\n        width: 100vw;\n        height: 100vh;\n        top: 0;\n        left: 0;\n        z-index: 101;\n        pointer-events: none;\n      }\n      #dialog {\n        display: flex;\n        flex-direction: column;\n        min-width: var(--min_width, 20rem);\n        width: var(--width, fit-content);\n        max-width: var(--max_width, calc(100vw - 2rem));\n        min-height: var(--min_height, 12rem);\n        height: var(--height, fit-content);\n        max-height: var(--max_height, calc(100vh - 2rem));\n        background-color: var(--c_bg);\n        box-shadow: var(--drop_shadow);\n        border-radius: var(--radius);\n        pointer-events: all;\n      }\n      #header {\n        display: flex;\n        align-items: center;\n      }\n      #header.has-title {\n        border-bottom: 1px solid var(--c_border);\n      }\n      #title {\n        flex: 1 1 auto;\n      }\n      #close {\n        border: 0px;\n        background: transparent;\n        box-shadow: 0 0 0 transparent;\n        color: var(--tc);\n      }\n      #close k-icon {\n        pointer-events: none;\n      }\n      #body {\n        flex: 1 1 auto;\n      }\n      #footer {\n        display: flex;\n        justify-content: flex-end;\n        padding: var(--spacer_h);\n      }\n    `}static renderOnChange=["opened","closeBtn","overlayClose","title","confirmText","cancelText"];static create(n="",e={}){const t=new Dialog({opened:!0,...e});onEvent(t,"close",t.remove),n instanceof HTMLElement||n instanceof DocumentFragment?t.appendChild(n):n instanceof NodeList?n.forEach((n=>t.appendChild(n))):t.innerHTML=n,document.body.appendChild(t)}static confirm(n,e,t){Dialog.create(`\n      <h5 slot="title" class="pyh px m0">Confirm Event Deletion</h5>\n      <p class="p">${n}</p>\n    `,{...t,closeBtn:!1,overlayClose:!1,confirmText:"Yes",confirmClasses:"success ml",confirmAction:()=>e(!0),cancelText:"No",cancelClasses:"danger",cancelAction:()=>e(!1)})}}window.customElements.define("k-dialog",Dialog);