import ReactiveLazyComponent from './ReactiveLazyComponent.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

const toggleClickHandler = Symbol('toggleClickHandler');
export default class Collapse extends ReactiveLazyComponent {
  constructor(){
    super();

    this[toggleClickHandler] = () => {
      this.toggle();
      this.shadowRoot.getElementById('toggle').focus();
    };

    this.registerAttribute('opened', false);
  }
  async render(force){
    if(super.render(force)){
      onEvent(this.shadowRoot.getElementById('toggle'), 'click', this[toggleClickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    offEvent(this.shadowRoot.getElementById('toggle'), 'click', this[toggleClickHandler]);
    super.disconnectedCallback();
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(n === 'opened'){
      if(nV){
        dispatchEvent(this, 'change opened');
      } else {
        dispatchEvent(this, 'change closed');
      }
    }
  }
  open(){
    this.opened = true;
  }
  close(){
    this.opened = false;
  }
  toggle(){
    this.opened = !this.opened;
    dispatchEvent(this, 'toggle');
  }
  get shadowTemplate(){
    return /*html*/`
      <button
        id="toggle"
        class="no-btn p"
      >
        <slot name="${this.opened?'closeText':'openText'}">${
          this.opened?'Hide Content':'Show Content'
        }</slot>
      </button>
      ${this.renderIf(this.opened, /*html*/`
        <div id="content">
          ${super.shadowTemplate}
        </div>
      `)}
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
      }
      #toggle {
        width: 100%;
      }
    `;
  }

  static renderOnChange = ['opened'];
  static observedAttributes = this.renderOnChange;
}
window.customElements.define('k-collapse', Collapse);