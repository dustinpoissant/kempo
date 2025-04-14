import Component from './Component.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

const _position = Symbol();
export class ToastContainer extends Component {
  constructor(position = 'bottom center'){
    super();

    /* Private Members */
    this[_position] = position.toLowerCase();

    /* Init */
    this.setAttribute('position', this[_position]);
  }

  /* Protected Members */
  get position(){
    return this[_position];
  }
  set position(val){
    if(val !== this[_position]){
      this[_position] = val.toLowerCase();
      this.setAttribute('position', this[_position]);
    }
  }

  /* Shadow DOM */
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        position: fixed;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 1000;
        pointer-events: none;
        padding: 16px;
        box-sizing: border-box;
        max-width: 100%;
        max-height: 100%;
        overflow: hidden;
      }

      :host([position*="top"]) {
        top: 0;
      }

      :host([position*="bottom"]) {
        bottom: 0;
      }

      :host([position*="left"]) {
        left: 0;
        align-items: flex-start;
      }

      :host([position*="right"]) {
        right: 0;
        align-items: flex-end;
      }

      :host([position*="center"]:not([position*="top"]):not([position*="bottom"])) {
        top: 50%;
        transform: translateY(-50%);
      }
      
      :host([position="center"]),
      :host([position*="center"][position*="top"]),
      :host([position*="center"][position*="bottom"]) {
        left: 50%;
        transform: translateX(-50%);
      }

      :host([position*="center"]:not([position="center"])) {
        align-items: center;
      }
      
      /* Combined transforms for center vertically and horizontally */
      :host([position*="center"]:not([position*="top"]):not([position*="bottom"]):not([position="center"])) {
        transform: translate(-50%, -50%);
      }

      ::slotted(*) {
        pointer-events: auto;
      }
    `;
  }
}
window.customElements.define('k-toast-container', ToastContainer);

const closeHandler = Symbol(),
      actionHandler = Symbol(),
      timeoutId = Symbol(),
      animationEndHandler = Symbol(),
      _toastPosition = Symbol(),
      _closing = Symbol();

export default class Toast extends Component {
  constructor({
    actionCallback = () => {},
    closeCallback = () => {},
    timeout = 0,
    position = 'bottom center'
  } = {}){
    super();

    /* Private Members */
    this[timeoutId] = -1;
    this[_toastPosition] = position.toLowerCase();
    this[_closing] = false;

    /* Private Methods */
    this[closeHandler] = () => {
      this.close();
    }
    this[actionHandler] = () => {
      if(this.actionCallback() !== false){
        this.close();
      }
    }
    this[animationEndHandler] = (e) => {
      if (e.animationName.includes('toast-hide')) {
        this.removeAttribute('animating');
        this.opened = false;
        dispatchEvent(this, 'close openchange');
        this.closeCallback();
        this[_closing] = false;
      } else if (e.animationName.includes('toast-show')) {
        this.removeAttribute('animating');
      }
    }

    /* Init */
    this.registerProps({
      actionCallback,
      closeCallback
    });
    this.registerAttributes({
      hasAction: false,
      hasClose: false,
      hasIcon: false,
      timeout,
      opened: false,
      position: this[_toastPosition]
    });
  }

  /* Lifecycle Callback */
  async render(force){
    if(await super.render(force)){
      onEvent(this.shadowRoot.getElementById('action'), 'click', this[actionHandler]);
      onEvent(this.shadowRoot.getElementById('close'), 'click', this[closeHandler]);
      onEvent(this, 'animationend', this[animationEndHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    clearTimeout(this[timeoutId]);
    offEvent(this.shadowRoot.getElementById('action'), 'click', this[actionHandler]);
    offEvent(this.shadowRoot.getElementById('close'), 'click', this[closeHandler]);
    offEvent(this, 'animationend', this[animationEndHandler]);
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(n === 'opened' && oV !== nV && nV){
      this.hasAction = !!this.querySelector('[slot="action"]');
      this.hasClose = !!this.querySelector('[slot="close"]');
      this.hasIcon = !!this.querySelector('[slot="icon"]');
    }
  }

  /* Public Methods */
  open(){
    this[_closing] = false;
    this.setAttribute('animating', 'in');
    this.opened = true;
    if(this.timeout){
      clearTimeout(this[timeoutId]);
      this[timeoutId] = setTimeout(() => {
        this.close();
      }, this.timeout);
    }
    dispatchEvent(this, 'open openchange');
  }
  
  close(){
    clearTimeout(this[timeoutId]);
    if (this.opened && !this[_closing]) {
      this[_closing] = true;
      this.setAttribute('animating', 'out');
      // We'll set opened to false in the animation end handler
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <div id="icon">
        <slot name="icon"></slot>
      </div>
      <div id="message">
        ${super.shadowTemplate}
      </div>
      <button id="action" class="no-style">
        <slot name="action"></slot>
      </button>
      <button id="close" class="no-style">
        <slot name="close"></slot>
      </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      @keyframes toast-show-bottom {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes toast-hide-bottom {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(20px); }
      }
      @keyframes toast-show-top {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes toast-hide-top {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
      @keyframes toast-show-left {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes toast-hide-left {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(-20px); }
      }
      @keyframes toast-show-right {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes toast-hide-right {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(20px); }
      }
      :host {
        display: none;
        min-width: 16rem;
        max-width: calc(100% - ( 2 * var(--spacer) ));
        background-color: var(--c_bg);
        border-radius: var(--radius);
        box-shadow: var(--drop_shadow);
      }
      :host([opened="true"]) {
        display: flex;
      }
      :host([animating="in"][position*="bottom"]) {
        animation: toast-show-bottom var(--animation_ms, 300ms) ease forwards;
      }
      :host([animating="out"][position*="bottom"]) {
        animation: toast-hide-bottom var(--animation_ms, 300ms) ease forwards;
      }
      :host([animating="in"][position*="top"]) {
        animation: toast-show-top var(--animation_ms, 300ms) ease forwards;
      }
      :host([animating="out"][position*="top"]) {
        animation: toast-hide-top var(--animation_ms, 300ms) ease forwards;
      }
      :host([animating="in"][position*="left"]:not([position*="top"]):not([position*="bottom"])) {
        animation: toast-show-left var(--animation_ms, 300ms) ease forwards;
      }
      :host([animating="out"][position*="left"]:not([position*="top"]):not([position*="bottom"])) {
        animation: toast-hide-left var(--animation_ms, 300ms) ease forwards;
      }
      :host([animating="in"][position*="right"]:not([position*="top"]):not([position*="bottom"])) {
        animation: toast-show-right var(--animation_ms, 300ms) ease forwards;
      }
      :host([animating="out"][position*="right"]:not([position*="top"]):not([position*="bottom"])) {
        animation: toast-hide-right var(--animation_ms, 300ms) ease forwards;
      }
      #icon {
        padding: var(--spacer);
        padding-right: 0;
      }
      #message {
        padding: var(--spacer);
        flex: 1 1 auto;
      }
      :host(:not([has-close])) #close,
      :host(:not([has-action])) #action,
      :host(:not([has-icon])) #icon {
        display: none;
      }
      #action {
        background: transparent;
        border: none;
        color: var(--tc_primary, blue);
        cursor: pointer;
        padding: var(--spacer);
      }
      #action:hover {
        color: var(--tc_primary__hover, lightblue);
      }
      #close {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: var(--spacer);
        opacity: 0.7;
        transition: opacity var(--animation_ms);
      }
      #close:hover {
        opacity: 1;
      }
    `;
  }

  /* Static Members */
  static observedAttributes = [...super.observedAttributes, 'opened'];

  /* Static Methods */
  static create(message, options = {}){
    let {
      position = 'auto',
      removeOnClose = true,
      closeCallback = () => {},
      action = false,
      close = false,
      icon = false
    } = options;
    if(position === 'auto'){
      position = window.innerWidth <= 768 ? 'bottom center' : 'top right';
    }
    let $container = document.querySelector(`k-toast-container[position="${position}"]`);
    if(!$container){
      $container = new ToastContainer(position);
      document.body.appendChild($container);
    }
    const $toast = new Toast({
      position,
      timeout: 5000,
      ...options,
      closeCallback: (...args) => {
        if(removeOnClose){
          $toast.remove();
          if($container.children.length === 0){
            $container.remove();
          }
        }
        closeCallback(...args);
      }
    });
    $toast.innerHTML = message;
    if(icon){
      if(icon instanceof HTMLElement){
        icon.slot = 'icon';
        $toast.appencChild(icon);
      } else if(typeof(icon) === 'string'){
        const $span = document.createElement('span');
        $span.slot = 'icon';
        $span.innerHTML = icon;
        $toast.appendChild($span);
      }
    }
    if(action){
      if(action instanceof HTMLElement){
        action.slot = 'action';
        $toast.appencChild(action);
      } else if(typeof(action) === 'string'){
        const $span = document.createElement('span');
        $span.slot = 'action';
        $span.innerHTML = action;
        $toast.appendChild($span);
      }
    }
    if(close){
      if(close instanceof HTMLElement){
        close.slot = 'close';
        $toast.appencChild(close);
      } else if(typeof(close) === 'string'){
        const $span = document.createElement('span');
        $span.slot = 'close';
        $span.innerHTML = close;
        $toast.appendChild($span);
      }
    }
    $toast.open();
    $container.appendChild($toast);
    return $toast;
  }
  static success(message, options = {}){
    const $toast = Toast.create(message, {
      icon: '<k-icon name="check"></k-icon>',
      ...options
    });
    $toast.classList.add('bg-success');
    return $toast;
  }
  static warning(message, options = {}){
    const $toast = Toast.create(message, {
      icon: '<k-icon name="warning"></k-icon>',
      ...options
    });
    $toast.classList.add('bg-warning');
    return $toast;
  }
  static error(message, options = {}){
    const $toast = Toast.create(message, {
      icon: '<k-icon name="error"></k-icon>',
      ...options
    });
    $toast.classList.add('bg-danger');
    return $toast;
  }
}
window.customElements.define('k-toast', Toast);
