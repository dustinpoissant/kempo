import Component from './Component.js';
import drag from '../utils/drag.js';
import {
  dispatchEvent
} from '../utils/element.js';

const dragStartWidth = Symbol(),
      dragStartCallback = Symbol(),
      dragEndCallback = Symbol(),
      dragCallback = Symbol(),
      dragCleanup = Symbol();
export default class Split extends Component {
  constructor(_saveWidth, _loadWidth){
    super();

    /* Private Members */
    this[dragStartWidth] = 0;

    /* Private Methods */
    this[dragStartCallback] = () => {
      this.resizing = true;
      this[dragStartWidth] =  Math.round(this.shadowRoot.getElementById('left').getBoundingClientRect().width);
      dispatchEvent(this, 'resizestart', {
        startSize: this[dragStartWidth]
      });
    }
    this[dragCallback] = ({x}) => {
      const size = `${this[dragStartWidth] + x}px`;
      this.setSize(size);
      dispatchEvent(this, 'resize', { size } );
    }
    this[dragEndCallback] = ({x}) => {
      this.resizing = false;
      const width = this[dragStartWidth] + x;
      const size = `${width}px`;
      this.setSize(size);
      dispatchEvent(this, 'resizeend', { size } );
    }
    this[dragCleanup] = () => {}

    /* Init */
    this.registerAttribute('resizing', false);
  }

  async connectedCallback(){
    super.connectedCallback();
    this[dragCleanup] = drag({
      element: this.shadowRoot.getElementById('divider-handle'),
      callback: this[dragCallback],
      startCallback: this[dragStartCallback],
      endCallback: this[dragEndCallback]
    });
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    this[dragCleanup]();
  }

  setSize(size){
    this.style.setProperty('--left_width', size);
  }

  get shadowTemplate(){
    return /*html*/`
      <div
        id="left"
        class="pane"
      >
        ${super.shadowTemplate}
      </div>
      <div id="divider-handle">
        <div id="divider-border"></div>
      </div>
      <div
        id="right"
        class="pane"
      >
        <slot name="right"></slot>
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        --left_width: calc( (100% - var(--handle_width)) / 2);
        --handle_width: 0.5rem;
        --min_pane_width: 6rem;

        height: 100%;
        display: flex;
        align-items: stretch;
        flex: 1 1 auto;
        overflow: hidden;
      }
      .pane, #divider-handle {
        display: inline-block;
      }
      .pane {
        min-width: var(--min_pane_width);
        max-width: calc(100% - var(--min_pane_width));
        max-height: 100%;
        overflow: hidden;
      }
      #left {
        flex: 0 0 var(--left_width);
      }
      #divider-handle {
        display: flex;
        justify-content: center;
        width: var(--handle_width);
        cursor: ew-resize;
      }
      :host([resizing]) #divider-handle {
        background-color: var(--tc_primary);
      }
      :host([resizing]) .pane {
        pointer-events: none;
        user-select: none;
      }
      #divider-border {
        width: 1px;
        height: 100%;
        border-left: 1px solid var(--c_border);
      }
      #right {
        flex: 1 1;
      }
      
    `;
  }
}
window.customElements.define('k-split', Split);
