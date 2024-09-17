import LazyComponent from './LazyComponent.js';
import './Icon.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

const toggleClickHandler = Symbol();
export default class ShowMore extends LazyComponent {
  constructor(){
    super();

    this[toggleClickHandler] = () => this.toggle();

    this.registerAttribute('opened', false);
  }
  
  /* Lifecycle Callbacks */
  async render(force){
    await super.render(force);
    onEvent(this.shadowRoot.getElementById('toggle'), 'click', this[toggleClickHandler]);
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('toggle'), 'click', this[toggleClickHandler]);
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(n === 'opened' && oV !== nV){
      if(this.opened){
        dispatchEvent(this, 'change opened');
      } else {
        dispatchEvent(this, 'change closed');
      }
    }
  }

  /* Public Methods */
  more(){
    this.opened = true;
  }
  less(){
    this.opened = false;
  }
  toggle(){
    this.opened = !this.opened;
  }

  get shadowTemplate(){
    return /*html*/`
      <div id="wrapper">
        <div id="content">
          ${super.shadowTemplate}
        </div>
        <button
          id="toggle"
          class="no-btn"
        >
          <span id="more">
            <slot name="more">Show More <k-icon name="arrow-down-double"></k-icon></slot>
          </span>
          <span id="less">
            <slot name="less">Show Less <k-icon name="arrow-up-double"></k-icon></slot>
          </span>
        </button>
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        --closed_height: 7rem;
        
        display: block;
      }
      :host(:not([opened])) #content{
        height: var(--closed_height);
        overflow-y: hidden;
      }
      :host(:not([opened])) #content {
        margin-bottom: calc(var(--closed_height) * -0.9);
      }
      :host(:not([opened]))  #toggle {
        padding-top: calc(var(--closed_height) - 2rem);
        background: linear-gradient(to bottom, transparent 0%, var(--c_bg) 95%);
      }
      #toggle {
        width: 100%;
        padding: var(--spacer_h);
        text-align: center;
        background: var(--c_bg);
      }
      :host([opened]) #more,
      :host(:not([opened])) #less {
        display: none;
      }
    `;
  }
}
window.customElements.define('k-show-more', ShowMore);
