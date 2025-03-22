import Component from './Component.js';
import './Icon.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';

const openHandler = Symbol(),
      closeHandler = Symbol(),
      overlayHandler = Symbol(),
      prevHandler = Symbol(),
      nextHandler = Symbol(),
      keyboardHandler = Symbol(),
      imgKeyboardHandler = Symbol();
export default class PhotoViewer extends Component {
  constructor(src = '', alt = '', options = {}){
    super();
    const {
      keyboardControls = true,
      global = false
    } = options;
    
    this.registerAttributes({
      src,
      alt,
      fullscreen: false,
      keyboardControls,
      global
    });
  }
  /* Lifecycle Callbacks */
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(this.rendered && n === 'src' && oV !== nV){
      this.shadowRoot.getElementById('img').src = nV;
      this.shadowRoot.getElementById('fullscreen-img').src = nV;
    } else if(this.rendered && n === 'alt' && oV !== nV){
      this.shadowRoot.getElementById('img').alt = nV;
      this.shadowRoot.getElementById('fullscreen-img').alt = nV;
    } else if(this.rendered && n === 'fullscreen' && oV !== nV){
      dispatchEvent(this, `fullscreenchange ${nV?' fullscreen':' fullscreenclose'}`);
      this.updateNavigationState();
      if(this.keyboardControls) {
        if(nV) {
          document.addEventListener('keydown', this[keyboardHandler]);
        } else {
          document.removeEventListener('keydown', this[keyboardHandler]);
        }
      }
    }
  }
  async render(force){
    if(await super.render(force)){
      const $img = this.shadowRoot.getElementById('img')
      $img.src = this.src;
      $img.alt = this.alt;
      const $fullImg = this.shadowRoot.getElementById('fullscreen-img')
      $fullImg.src = this.src;
      $fullImg.alt = this.alt;
      
      // Handle fullscreen caption
      const fullscreenSlot = this.shadowRoot.querySelector('slot[name="fullscreen-caption"]');
      if (fullscreenSlot && !fullscreenSlot.assignedNodes().length) {
        const defaultSlot = this.shadowRoot.querySelector('slot:not([name])');
        const contents = defaultSlot.assignedNodes();
        contents.forEach(node => {
          const clone = node.cloneNode(true);
          this.appendChild(clone).slot = 'fullscreen-caption';
        });
      }

      onEvent($img, 'click', this[openHandler]);
      onEvent($img, 'keydown', this[imgKeyboardHandler]);
      onEvent(this.shadowRoot.getElementById('close'), 'click', this[closeHandler]);
      onEvent(this.shadowRoot.getElementById('fullscreen-overlay'), 'click', this[overlayHandler]);
      onEvent(this.shadowRoot.getElementById('prev'), 'click', this[prevHandler]);
      onEvent(this.shadowRoot.getElementById('next'), 'click', this[nextHandler]);
      this.updateNavigationState();
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('img'), 'click', this[openHandler]);
    offEvent(this.shadowRoot.getElementById('img'), 'keydown', this[imgKeyboardHandler]);
    offEvent(this.shadowRoot.getElementById('close'), 'click', this[closeHandler]);
    offEvent(this.shadowRoot.getElementById('fullscreen-overlay'), 'click', this[overlayHandler]);
    offEvent(this.shadowRoot.getElementById('prev'), 'click', this[prevHandler]);
    offEvent(this.shadowRoot.getElementById('next'), 'click', this[nextHandler]);
    if(this.keyboardControls) {
      document.removeEventListener('keydown', this[keyboardHandler]);
    }
  }

  /* Private Methods */
  [imgKeyboardHandler] = (e) => {
    if(e.key === 'Enter' && !this.fullscreen) {
      this.open();
    }
  }
  [openHandler] = () => {
    this.open();
  }
  [closeHandler] = () => {
    this.close();
  }
  [overlayHandler] = (e) => {
    if (e.target === e.currentTarget) {
      this.close();
    }
  }
  [prevHandler] = (e) => {
    e.stopPropagation();
    const prev = this.getPrevSibling();
    if(prev) {
      this.close();
      prev.open();
    }
  }
  [nextHandler] = (e) => {
    e.stopPropagation();
    const next = this.getNextSibling();
    if(next) {
      this.close();
      next.open();
    }
  }
  [keyboardHandler] = (e) => {
    if(e.key === 'Escape') {
      this.close();
    } else if(e.key === 'ArrowLeft') {
      const prev = this.getPrevSibling();
      if(prev) {
        this.close();
        prev.open();
      }
    } else if(e.key === 'ArrowRight') {
      const next = this.getNextSibling();
      if(next) {
        this.close();
        next.open();
      }
    }
  }
  getPrevSibling() {
    if (this.global) {
      // Find any PhotoViewer in document
      const viewers = Array.from(document.getElementsByTagName('k-photo-viewer'));
      const index = viewers.indexOf(this);
      if (index === -1) return null;
      return viewers[index === 0 ? viewers.length - 1 : index - 1];
    } else {
      // Only look at direct siblings
      let prev = this.previousElementSibling;
      while (prev && prev.tagName !== 'K-PHOTO-VIEWER') {
        prev = prev.previousElementSibling;
      }
      if (!prev && this.hasPhotoSiblings()) {
        prev = this.parentElement.lastElementChild;
        while (prev && prev.tagName !== 'K-PHOTO-VIEWER') {
          prev = prev.previousElementSibling;
        }
      }
      return prev;
    }
  }

  getNextSibling() {
    if (this.global) {
      // Find any PhotoViewer in document
      const viewers = Array.from(document.getElementsByTagName('k-photo-viewer'));
      const index = viewers.indexOf(this);
      if (index === -1) return null;
      return viewers[index === viewers.length - 1 ? 0 : index + 1];
    } else {
      // Only look at direct siblings
      let next = this.nextElementSibling;
      while (next && next.tagName !== 'K-PHOTO-VIEWER') {
        next = next.nextElementSibling;
      }
      if (!next && this.hasPhotoSiblings()) {
        next = this.parentElement.firstElementChild;
        while (next && next.tagName !== 'K-PHOTO-VIEWER') {
          next = next.nextElementSibling;
        }
      }
      return next;
    }
  }

  hasPhotoSiblings() {
    if (this.global) {
      return document.getElementsByTagName('k-photo-viewer').length > 1;
    }
    return Array.from(this.parentElement.children)
      .filter(el => el !== this && el.tagName === 'K-PHOTO-VIEWER')
      .length > 0;
  }

  updateNavigationState() {
    const hasNavigation = this.fullscreen && this.hasPhotoSiblings();
    const nav = this.shadowRoot.querySelectorAll('.nav-btn');
    nav.forEach(btn => btn.classList.toggle('d-n', !hasNavigation));
  }

  /* Public Methods */
  open(){
    this.fullscreen = true;
  }
  close(){
    this.fullscreen = false;
  }
  toggle(){
    this.fullscreen = !this.fullscreen;
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <div id="wrapper">
        <img id="img" tabindex="0" />
        <div class="caption">
          <slot></slot>
        </div>
        <div id="fullscreen-overlay">
          <button id="close" class="no-btn">
            <slot name="close">
              <k-icon name="close"></k-icon>
            </slot>
          </button>
          <button id="prev" class="nav-btn no-btn">
            <slot name="prev">
              <k-icon name="chevron-left"></k-icon>
            </slot>
          </button>
          <button id="next" class="nav-btn no-btn">
            <slot name="next">
              <k-icon name="chevron-right"></k-icon>
            </slot>
          </button>
          <div class="content">
            <img id="fullscreen-img" />
            <div class="caption">
              <slot name="fullscreen-caption"></slot>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
      }
      #wrapper {
        position: relative;
        width: 100%;
        height: 100%;
      }
      #img {
        max-width: 100%;
        height: auto;
        cursor: pointer;
        outline: none;
        border-radius: var(--img_radius, 0);
      }
      #img:focus {
        box-shadow: var(--focus_shadow);
      }
      #fullscreen-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        background: rgba(0,0,0,0.9);
        padding: 2rem;
        display: none;
      }
      :host([fullscreen]) #fullscreen-overlay {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .content {
        position: relative;
        max-width: 100%;
        max-height: 90vh;
      }
      #fullscreen-img {
        max-height: 75vh;
        max-width: 100%;
        object-fit: contain;
        cursor: default;
      }
      #close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 1;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
      }
      .nav-btn {
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        z-index: 1;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 1rem;
        opacity: 0.7;
        font-size: 3rem;
        -webkit-text-stroke: 1px black;
        text-stroke: 1px black;
        text-shadow: 0 0 3px rgba(0,0,0,0.8);
      }
      .nav-btn::slotted(*),
      .nav-btn k-icon {
        filter: drop-shadow(0 0 2px rgba(0,0,0,1)) drop-shadow(0 0 2px rgba(0,0,0,1));
      }
      .nav-btn:hover {
        opacity: 1;
      }
      #prev {
        left: 1rem;
      }
      #next {
        right: 1rem;
      }
      .caption {
        text-align: center;
        max-width: 600px;
        width: fit-content;
        margin: 1rem auto 0;
      }
      #fullscreen-overlay .caption {
        color: white;
      }
      :host([fullscreen]) .caption {
        color: white;
      }
    `;
  }

  /* Static Members */
  static observedAttributes = [...super.observedAttributes, 'src', 'alt', 'fullscreen', 'keyboard-controls', 'global'];
}
window.customElements.define('k-photo-viewer', PhotoViewer);