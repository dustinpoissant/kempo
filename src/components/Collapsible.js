import Component from './Component.js';
import './Icon.js';
import { onEvent, offEvent, dispatchEvent } from '../utils/element.js';

const clickHandler = Symbol('clickHandler');
export default class Collapsible extends Component {
  constructor(opened = false){
    super();

    /* Private Methods */
    this[clickHandler] = () => {
      this.toggle();
    }

    /* Init */
    this.registerAttributes({
      opened
    });
  }

  /* Lifecycle Callbacks */
  async render(force){
    if(await super.render(force)){
      onEvent(this.shadowRoot.getElementById('label'), 'click', this[clickHandler]);
      return  true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('label'), 'click', this[clickHandler]);
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(n === 'opened' && oV !== nV){
      dispatchEvent(this, `openedchanged ${nV==='true'?'open':'close'}`);
    }
  }

  /* Public Methods */
  open(){
    this.opened = true;
  }
  close(){
    this.opened = false;
  }
  toggle(){
    this.opened = !this.opened;
    dispatchEvent(this, 'openedtoggled');
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <div id="labelContainer">
        <div id="label">
          <slot name="label"></slot>
        </div>
        <div id="labelIcon">
          <slot name="labelIcon">
            <k-icon name="chevron-right"></k-icon>
          </slot>
        </div>
      </div>
      <div id="content">
        ${super.shadowTemplate}
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
      }
      #labelContainer {
        display: flex;
        cursor: pointer;
      }
      #label {
        flex: 1 1 auto;
      }
      #labelIcon {
        flex: 0 0 none;
        opacity: 0.5;
        transform: rotate(90deg);
        transition: transform var(--animation_ms, 256ms);
      }
      #labelContainer:hover #labelIcon {
        opacity: 1;
      }
      :host([opened="true"]) #labelIcon {
        transform: rotate(-90deg);
      }
      :host(:not([opened="true"])) #content {
        display: none;
      }
    `;
  }

  /* Static Attributes */
  static observedAttributes = [...super.observedAttributes, 'opened'];
}
window.customElements.define('k-collapsible', Collapsible);
