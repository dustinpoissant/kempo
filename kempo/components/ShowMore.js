import LazyComponent from './LazyComponent.js';
import './Icon.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

export default class ShowMore extends LazyComponent {
  constructor(){
    super();

    this.registerAttribute('opened', false);
    this.registerProp('_toggleClickHandler', () => this.toggle());
  }
  async render(force){
    await super.render(force);
    onEvent(this.shadowRoot.getElementById('toggle'), 'click', this._toggleClickHandler);
  }
  more(){
    this.opened = true;
  }
  less(){
    this.opened = false;
  }
  toggle(){
    this.opened?this.less():this.more();
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
