import LazyComponent from './LazyComponent.js';
import './Icon.js';
import './FocusCapture.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

export class SideMenu extends LazyComponent {
  constructor(){
    super();

    this.registerAttribute('opened', false);
    this.registerAttribute('overlayClose', true);
    this.registerProps({
      _overlayClick: () => {
        if(this.overlayClose) this.close();
      }
    });
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('overlay'), 'click', this._overlayClick);
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(n === 'opened'){
      if(nV === 'true'){
        dispatchEvent(this, 'change open');
      } else {
        dispatchEvent(this, 'change close');
      }
    }
  }
  render(force){
    super.render(force);
    onEvent(this.shadowRoot.getElementById('overlay'), 'click', this._overlayClick);
  }
  open(){
    this.opened = true;
  }
  close(){
    this.opened = false;
  }
  toggle(){
    this.opened?this.close():this.open();
    dispatchEvent(this, 'toggle');
  }
  get shadowTemplate(){
    return /*html*/`
      <k-focus-capture>
        <div id="container">
          <button id="overlay" class="no-btn">
            <k-icon id="overlay-x" name="close"></k-icon>
          </button>
          <div id="menu">
            ${super.shadowTemplate}
          </div>
        </div>
      </k-focus-capture>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        --bg: var(--c_bg);
        --width: 20rem;

        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        max-width: 100%;
        height: 100vh;
        z-index: 100;
        pointer-events: none;
      }
      :host([opened]) {
        pointer-events: auto;
      }
      k-focus-capture {
        width: 100%;
        height: 100%;
      }
      #container {
        position: relative;
        width: 100%;
        height: 100%;
        opacity: 0;
        transition: opacity var(--animation_ms, 256ms);
      }
      :host([opened]) #container {
        opacity: 1;
      }
      #overlay {
        position: absolute;
        width: 100%;
        height: 100%;
        left: 0;
        top: 0;
        background: var(--overlay, rgba(0, 0, 0, 0.5));
      }
      #overlay-x {
        position: absolute;
        top: var(--spacer_h);
        right: var(--spacer_h);
        font-size: 1.75rem;
        cursor: pointer;
        color: var(--tc_light);
      }
      :host(:not([overlay-close])) #overlay-x {
        display: none;
      }
      #menu {
        position: absolute;
        width: var(--width);
        max-width: calc(100vw - 6rem);
        height: 100vh;
        overflow-y: auto;
        left: calc(var(--width) * -1);
        top: 0;
        background: var(--bg);
        transition: left var(--animation_ms, 256ms);
        padding: var(--menu_padding, var(--spacer))
      }
      :host([opened]) #menu {
        left: 0;
      }
    `;
  }

  static get observedAttributes(){
    return [
      'opened',
      ...super.observedAttributes
    ]
  }
}
window.customElements.define('k-side-menu', SideMenu);