import Component from"./Component.js";import{onEvent,offEvent,dispatchEvent}from"../utils/element.js";import raf from"../utils/raf.js";export default class Accordion extends Component{constructor(){super(),this.unrender=!0}get activeHeader(){return this.querySelector('k-accordion-header[active="true"]')}get activePanel(){return this.querySelector('k-accordion-panel[active="true"]')}getHeader(e){return this.querySelector(`k-accordion-header[for-panel="${e}"]`)}getPanel(e){return this.querySelector(`k-accordion-panel[name="${e}"]`)}openPanel(e){const t=this.querySelector('k-accordion-panel[active="true"]');if(t&&t.name!==e){t.active=!1;const e=this.getHeader(t.name);e&&(e.active=!1)}const n=this.getPanel(e);if(n){n.active=!0,n.transitioning=!0,setTimeout((()=>{n.transitioning=!1}),parseInt(getComputedStyle(this).getPropertyValue("--animation_ms")||256));const t=this.getHeader(e);t&&(t.active=!0),dispatchEvent(this,"openpanel",{panelName:e})}}closePanel(e){const t=this.getPanel(e);if(t){t.active=!1,t.transitioning=!0,setTimeout((()=>{t.transitioning=!1}),parseInt(getComputedStyle(this).getPropertyValue("--animation_ms")||256));const n=this.getHeader(e);n&&(n.active=!1),dispatchEvent(this,"closepanel",{panelName:e})}}togglePanel(e){const t=this.getPanel(e);t&&(t.active?this.closePanel(e):this.openPanel(e),dispatchEvent(this,"togglepanel",{panelName:e}))}get shadowStyles(){return'\n      :host {\n        display: block;\n        border: 1px solid var(--c_border);\n        border-radius: var(--radius);\n      }\n      ::slotted(k-accordion-header){\n        border-top: 1px solid var(--c_border);\n      }\n      ::slotted(k-accordion-header[active="true"]) {\n        border-bottom: 1px solid var(--c_border);\n      }\n      ::slotted(k-accordion-header:first-of-type) {\n        border-top: 0;\n      }\n      ::slotted(k-accordion-header:last-of-type:not([active="true"])) {\n        border-bottom: 0;\n      }\n    '}}window.customElements.define("k-accordion",Accordion);const clickHandler=Symbol();export class AccordionHeader extends Component{constructor(e="Show More",t=""){super(),this[clickHandler]=()=>{this.accordion.togglePanel(this.forPanel)},this.registerAttributes({forPanel:t,active:!1})}async render(e){return!!await super.render(e)&&(onEvent(this,"click",this[clickHandler]),!0)}disconnectedCallback(){super.disconnectedCallback(),offEvent(this,"click",this[clickHandler])}get accordion(){return this.closest("k-accordion")}get shadowStyles(){return"\n      :host {\n        display: block;\n        padding: 1rem;\n        cursor: pointer;\n      }\n    "}}window.customElements.define("k-accordion-header",AccordionHeader);export class AccordionPanel extends Component{constructor(e=""){super(),this.registerAttributes({name:e,active:!1,transitioning:!1})}get accordion(){return this.closest("k-accordion")}get shadowStyles(){return`\n      ${super.shadowStyles}\n      :host {\n        display: block;\n        interpolate-size: allow-keywords;\n        height: 0;\n        overflow: hidden;\n        transition: height var(--animation_ms) ease-in-out;\n      }\n      :host([active="true"]) {\n        height: max-content;\n      }\n    `}}window.customElements.define("k-accordion-panel",AccordionPanel);