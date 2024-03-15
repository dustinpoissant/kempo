import Component from"./Component.js";import{setProp}from"../utils/element.js";export default class Card extends Component{constructor(r=""){super(),this.registerAttribute("label",r)}attributeChangedCallback(r,e,n){"label"===r&&setProp(this.shadowRoot.getElementById("label"),"innerHTML",n)}get shadowTemplate(){return`\n      <div id="card">\n        <div id="label">${this.label}</div>\n        ${super.shadowTemplate}\n      </div>\n    `}get shadowStyles(){return"\n      :host {\n        display: block;\n      }\n      #card {\n        border: 1px solid var(--c_border);\n        border-radius: var(--radius);\n        margin-bottom: var(--spacer);\n        padding: var(--spacer);\n        padding-top: calc(1.5 * var(--spacer));\n        position: relative;\n        background-color: var(--c_bg);\n      }\n      #label {\n        position: absolute;\n        top: -1.25em;\n        left: 1.25em;\n        background-color: var(--c_bg);\n        border: 1px solid var(--c_border);\n        border-radius: var(--radius);\n        padding: var(--spacer_h);\n      }\n      :host([label]) {\n        padding-top: calc(2 * var(--spacer));\n        margin-top: var(--spacer);\n      }\n      :host(:not([label])) #label {\n        display: none;\n      }\n\n    "}static get renderOnAttributes(){return["label"]}}window.customElements.define("k-card",Card);