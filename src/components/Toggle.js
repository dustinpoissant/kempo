import Component from './Component.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

const clickHandler = Symbol(),
      keyDownHandler = Symbol();
export default class Toggle extends Component {
  constructor(){
    super();

    this[clickHandler] = () => {
      this.toggle();
    }
    this[keyDownHandler] = ({code}) => {
      if(['Space', 'Enter'].includes(code)){
        this.toggle();
      }
    }

    this.registerAttributes({
      value: false
    });

    this.tabIndex = 0;
  }
  connectedCallback(){
    super.connectedCallback();
    onEvent(this, 'click', this[clickHandler]);
    onEvent(this, 'keydown', this[keyDownHandler]);
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this, 'click', this[clickHandler]);
    offEvent(this, 'keydown', this[keyDownHandler]);
  }
  attributeChangedCallback(n, oV, nV){
    if(n === 'value'){
      dispatchEvent(this, 'change', { value: nV });
    }
  }

  on(){
    this.value = true;
    dispatchEvent(this, 'on', { value: true });
    return this;
  }
  off(){
    this.value = false;
    dispatchEvent(this, 'on', { value: false });
    return this;
  }
  toggle(){
    if(this.value) this.off();
    else this.on();
    dispatchEvent(this, 'toggle', { value: this.value });
    return this;
  }

  get shadowTemplate(){
    return /*html*/`
      <div id="switch">
        <div id="handle"></div>
      </div>
      <label id="label">
        ${super.shadowTemplate}
      </label>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        --switch_height: 2rem;
        --switch_width: 3rem;
        --switch_border: 1px solid var(--c_border);
        --switch_background__off: var(--c_bg__alt);
        --switch_background__on: var(--c_success);
        --handle_size__off: 1rem;
        --handle_size__on: 1.5rem;
        --handle_border: 1px solid var(--c_border);
        --handle_background__off: var(--c_border);
        --handle_background__on: white;

        display: flex;
        align-items: center;
        cursor: pointer;
        margin-bottom: var(--spacer);
        border-radius: 999rem;
      }
      #switch {
        display: flex;
        align-items: center;
        width: var(--switch_width);
        height: var(--switch_height);
        border: var(--switch_border);
        background: var(--switch_background__off);
        border-radius: 999rem;
        margin-right: var(--spacer);
      }
      #handle {
        --margin: calc( (var(--switch_height) - var(--handle_size__off)) / 2);
        width: var(--handle_size__off);
        height: var(--handle_size__off);
        border: var(--handle_border);
        background: var(--handle_background__off);
        border-radius: 999rem;
        transform: translateX(var(--margin));
        transition: width var(--animation_ms, 256ms), height var(--animation_ms, 256ms), transform var(--animation_ms, 256ms);
      }
      :host([value="true"]) #switch {
        background: var(--switch_background__on);
      }
      :host([value="true"]) #handle {
        --m: calc( (var(--switch_height) - var(--handle_size__on)) / 2);
        --d: calc( var(--switch_width) - var(--handle_size__on) - var(--m));
        width: var(--handle_size__on);
        height: var(--handle_size__on);
        background: var(--handle_background__on);
        transform: translateX(var(--d));
      }
      #label {
        display: block;
        flex: 1 1 auto;
        padding: 0;
      }
    `
  }

  static observedAttributes = [
    ...Component.observedAttributes,
    'value'
  ];
}
window.customElements.define('k-toggle', Toggle);
