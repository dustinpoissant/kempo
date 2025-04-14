import Component from './Component.js';
import './FocusCapture.js';
import './Icon.js';
import {
  firstFocusable,
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

export default class Dialog extends Component {
  constructor({
    opened = false,
    closeBtn = true,
    overlayClose = true,
    confirmText = '',
    confirmClasses = 'success ml',
    confirmAction = () => {},
    cancelText = '',
    cancelClasses = '',
    cancelAction = () => {},
    closeCallback = () => {}
  } = {}){
    super();

    this.registerAttributes({
      opened,
      closeBtn,
      overlayClose,
      confirmText,
      confirmClasses,
      cancelText,
      cancelClasses
    });
    this.registerProps({
      confirmAction,
      cancelAction,
      closeCallback,
      previousFocus: null,
      _clickHandler: (event) => {
        const {target: { id }} = event;
        if(
          (id == 'overlay' && this.overlayClose) || 
          id == 'close'
        ){
          this.close();
        } else if(id == 'cancel'){
          this.cancelAction(event);
          if(!event.defaultPrevented) this.close();
        } else if(id == 'confirm'){
          this.confirmAction(event);
          if(!event.defaultPrevented) this.close();
        }
      },
      _keydownHandler: ({ keyCode }) => {
        if(keyCode === 27){
          this.close();
        }
      },
      _hasTitle: () => !!this.querySelector('[slot="title"]')
    });
  }
  connectedCallback(){
    super.connectedCallback();
    onEvent(this.shadowRoot, 'click', this._clickHandler);
  }
  disconnectedCallback(){
    super.connectedCallback();
    offEvent(this.shadowRoot, 'click', this._clickHandler);
    offEvent(window, 'keydown', this._keydownHandler); // just in case this was removed without being closed first
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(name === 'opened'){
      dispatchEvent(this, nV?'opened':'close');
    }
  }
  open(){
    this.opened = true;
    const $toFucus = this.shadowRoot.querySelector('[autofocus]') || firstFocusable(this.shadowRoot);
    if($toFucus) $toFucus.focus();
    onEvent(window, 'keydown', this._keydownHandler);
  }
  close(){
    this.opened = false;
    this.blur();
    this.closeCallback();
    offEvent(window, 'keydown', this._keydownHandler);
  }
  toggle(){
    this.opened?this.close():this.open();
  }
  focus(){
    const $firstFocus = firstFocusable(this.shadowRoot);
    if($firstFocus){
      this.previousFocus = document.activeElement;
      $firstFocus.focus();
    }
  }
  blur(){
    if(this.previousFocus){
      this.previousFocus.focus();
    }
  }

  get shadowTemplate(){
    return /*html*/`
      <k-focus-capture>
        <button id="overlay" aria-label="Close the Dialog"></button>
        <div id="wrapper">
          <div
            id="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="title"
          >
            <div
              id="header"
              class="${this._hasTitle()?'has-title':''}"
            >
              <div
                id="title"
              ><slot name="title"></slot></div>
              ${this.renderIf(this.closeBtn, /*html*/`
                <button
                  id="close"
                >
                  <k-icon name="close"></k-icon>
                </button>
              `)}
            </div>
            <div id="body">
              ${super.shadowTemplate}
            </div>
            ${this.renderIf(this.cancelText || this.confirmText, /*html*/`
              <div id="footer">
                ${this.renderIf(this.cancelText, /*html*/`
                  <button id="cancel" class="${this.cancelClasses}">
                    ${this.cancelText}
                  </button>
                `)}
                ${this.renderIf(this.confirmText, /*html*/`
                  <button id="confirm" class="${this.confirmClasses}">
                    ${this.confirmText}
                  </button>
                `)}
              </div>
            `)}
          </div>
        </div>
      </k-focus-capture>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: inline;
        height: 1px;
        width: 1px;
        position: fixed; /* The browser seems to sometimes lazy load this if its out of view, this seems to fix it*/
        top: 0;
        left: 0;
        z-index: 100;
      }
      :host(:not([opened])){
        display: none;
      }
      #overlay {
        position: fixed;
        width: 100vw;
        height: 100vh;
        top: 0;
        left: 0;
        background-color: var(--c_overlay);
        z-index: 100;
        border: 0px solid transparent;
        box-shadow: 0 0 0 transparent;
      }
      #wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        position: fixed;
        width: 100%;
        height: 100vh;
        top: 0;
        left: 0;
        z-index: 101;
        pointer-events: none;
      }
      #dialog {
        display: flex;
        flex-direction: column;
        min-width: var(--min_width, 20rem);
        width: var(--width, fit-content);
        max-width: var(--max_width, calc(100vw - 4rem));
        min-height: var(--min_height, 12rem);
        height: var(--height, fit-content);
        max-height: var(--max_height, calc(100vh - 4rem));
        background-color: var(--c_bg);
        box-shadow: var(--drop_shadow);
        border-radius: var(--radius);
        pointer-events: all;
      }
      #header {
        display: flex;
        align-items: center;
      }
      #header.has-title {
        border-bottom: 1px solid var(--c_border);
      }
      #title {
        flex: 1 1 auto;
      }
      #close {
        border: 0px;
        background: transparent;
        box-shadow: 0 0 0 transparent;
        color: var(--tc);
      }
      #close k-icon {
        pointer-events: none;
      }
      #body {
        flex: 1 1 auto;
      }
      #footer {
        display: flex;
        justify-content: flex-end;
        padding: var(--spacer_h);
      }
    `;
  }

  static renderOnChange = [
    'opened',
    'closeBtn',
    'overlayClose',
    'title',
    'confirmText',
    'cancelText'
  ];

  static create(contents = '', options = {}){
    if(options.closeExisting!==false)document.querySelectorAll('k-dialog').forEach(d=>d.close());
    const {
      removeOnClose = true,
      closeCallback = () => {}
    } = options;
    const $dialog = new Dialog({
      opened: true,
      ...options,
      closeCallback: (...args) => {
        if(removeOnClose){
          $dialog.remove();
        }
        closeCallback(...args);
      }
    });
    onEvent($dialog, 'close',  $dialog.remove);
    if(contents instanceof HTMLElement || contents instanceof DocumentFragment){
      $dialog.appendChild(contents);
    } else if(contents instanceof NodeList){
      contents.forEach( $el => $dialog.appendChild($el));
    } else {
      $dialog.innerHTML = contents;
    }
    if (options.width) $dialog.style.setProperty('--width', options.width);
    if (options.minWidth) $dialog.style.setProperty('--min_width', options.minWidth);
    if (options.maxWidth) $dialog.style.setProperty('--max_width', options.maxWidth);
    if (options.height) $dialog.style.setProperty('--height', options.height);
    if (options.minHeight) $dialog.style.setProperty('--min_height', options.minHeight);
    if (options.maxHeight) $dialog.style.setProperty('--max_height', options.maxHeight);
    document.body.prepend($dialog);
    $dialog.open();
    return $dialog;
  }
  static confirm(text, responseCallback, options = {
    title: 'Confirm'
  }){
    return Dialog.create(`
      <h5 slot="title" class="pyh px m0">${options.title}</h5>
      <p class="p">${text}</p>
    `, {
      ...options,
      closeBtn: false,
      overlayClose: false,
      confirmText: 'Yes',
      confirmClasses: 'success ml',
      confirmAction: () => {
        return responseCallback(true);
      },
      cancelText: 'No',
      cancelClasses: 'danger',
      cancelAction: () => {
        return responseCallback(false);
      }
    });
  }
  static alert(text, responseCallback, options = {
    title: 'Alert'
  }){
    return Dialog.create(`
      <h5 slot="title" class="pyh px m0">${options.title}</h5>
      <p class="p">${text}</p>
    `, {
      closeCallback: responseCallback,
      cancelText: 'Ok',
      ...options,
    });
  }
  static error(text, responseCallback, options = {
    title: 'Error'
  }){
    return Dialog.create(`
      <h5 slot="title" class="pyh px m0 tc-danger">${options.title}</h5>
      <p class="p">${text}</p>
    `, {
      closeCallback: responseCallback,
      cancelText: 'Ok',
      ...options,
    });
  }
  static success(text, responseCallback, options = {
    title: 'Success'
  }){
    return Dialog.create(`
      <h5 slot="title" class="pyh px m0 tc-success">${options.title}</h5>
      <p class="p">${text}</p>
    `, {
      closeCallback: responseCallback,
      cancelText: 'Ok',
      ...options,
    });
  }
}
window.customElements.define('k-dialog', Dialog);
