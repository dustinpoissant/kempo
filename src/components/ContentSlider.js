import LazyComponent from './LazyComponent.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

const content = Symbol(),
      prevClickHandler = Symbol(),
      nextClickHandler = Symbol(),
      keydownHandler = Symbol();
export default class ContentSlider extends LazyComponent {
  constructor(_content = [], {
    index = 0,
    controls = true,
    globalControls = false,
    keyboardControls = true,
    loop = false
  } = {}){
    super();

    /* Private Members */
    this[content] = [..._content];

    /* Private Methods */
    this[prevClickHandler] = () => this.previous();
    this[nextClickHandler] = () => this.next();
    this[keydownHandler] = (event) => {
      if(event.code === 'ArrowLeft'){
        event.preventDefault();
        dispatchEvent(this, 'keyleft');
        this.previous();
      } else if(event.code === 'ArrowRight'){
        event.preventDefault();
        dispatchEvent(this, 'keyright');
        this.next();
      }
    }

    /* Init */
    this.registerAttributes({
      index,
      controls,
      keyboardControls,
      globalControls,
      loop
    });
    this.tabIndex = 0;
  }

  /* Lifecycle Callback */
  connectedCallback(){
    super.connectedCallback();
    this[content] = [...this.querySelectorAll(':scope > *')];
  }
  async render(force){
    if(await super.render(force)){
      if(this.keyboardControls){ // add keyboard controls
        if(this.globalControls){
          onEvent(window, 'keydown', this[keydownHandler]);
        } else {
          onEvent(this, 'keydown', this[keydownHandler]);
          onEvent(this.shadowRoot, 'keydown', this[keydownHandler]);
        }
      }
      onEvent(this.shadowRoot.getElementById('prev'), 'click', this[prevClickHandler]);
      onEvent(this.shadowRoot.getElementById('next'), 'click', this[nextClickHandler]);
      this.renderContent();
      return true;
    }
    return false;
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(n === 'index' && oV !== nV){
      const newIndex = parseInt(nV);
      const validNew = Math.max(Math.min(this[content].length-1, newIndex), 0);
      if(newIndex !== validNew){
        this.index = validNew;
      } else {
        dispatchEvent(this, 'change', {
          index: validNew
        });
        this.renderContent();
      }
    } else if(n === 'keyboard-controls' && oV !== nV){
      if(this.keyboardControls){ // add keyboard controls
        if(this.globalControls){
          onEvent(window, 'keydown', this[keydownHandler]);
        } else {
          onEvent(this, 'keydown', this[keydownHandler]);
          onEvent(this.shadowRoot, 'keydown', this[keydownHandler]);
        }
      } else { // remove keyboard controls
        offEvent(this.globalControls?window:this.shadowRoot, 'keydown', this[keydownHandler]);
      }
    }
  }
  renderContent(){
    this.innerHTML = '';
    this.appendChild(this[content][this.index]);
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('prev'), 'click', this[prevClickHandler]);
    offEvent(this.shadowRoot.getElementById('next'), 'click', this[nextClickHandler]);
    offEvent(window, 'keydown', this[keydownHandler]);
    offEvent(this.shadowRoot, 'keydown', this[keydownHandler]);
    offEvent(this, 'keydown', this[keydownHandler]);
  }

  /* Public Methods */
  previous(){
    let newIndex = this.index - 1;
    if(this.loop){
      if(newIndex < 0) newIndex = this[content].length - 1;
    }
    dispatchEvent(this, 'previous', {index: newIndex});
    this.index = newIndex;
  }
  next(){
    let newIndex = this.index + 1;
    if(this.loop){
      if(newIndex >= this[content].length) newIndex = 0;
    }
    dispatchEvent(this, 'next', {index: newIndex});
    this.index = newIndex;
  }
  goto(newIndex){
    dispatchEvent(this, 'goto', {index: newIndex});
    this.index = newIndex;
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <div id="content">
        ${super.shadowTemplate}
      </div>
      <div id="controls">
        <button
          id="prev"
          class="no-btn"
        >
          <slot name="prev">
            <k-icon name="chevron-left"></k-icon>
          </slot>
        </button>
        <button
          id="next"
          class="no-btn"
        >
          <slot name="next">
            <k-icon name="chevron-right"></k-icon>
          </slot>
        </button>
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        position: relative;
        outline: none;
      }
      #prev,
      #next {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 2rem;
      }
      #next {
        right: 0;
      }
      :host(:not([controls="true"])) #controls {
        display: none;
      }
    `;
  }

  /* Static Members */
  static observedAttributes = [
    ...LazyComponent.observedAttributes,
    'index',
    'keyboard-controls',
    'global-controls'
  ];
}
window.customElements.define('k-content-slider', ContentSlider);
