import Component from './Component.js';
import { onEvent, offEvent, dispatchEvent } from '../utils/element.js';
import drag from '../utils/drag.js';

const dragStartHandler = Symbol('dragStartHandler'),
      dragMoveHandler = Symbol('dragMoveHandler'),
      dragEndHandler = Symbol('dragEndHandler'),
      cleanup = Symbol('cleanup');

export class Sortable extends Component {
  constructor(){
    super();

    this.registerAttributes({
      sorting: false
    });
  }
  async render(force){
    if(await super.render(force)){

    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    this.cleanupFuncs.forEach(func => func());
  }

  getCursorElement(){
    const items = Array.from(this.children).filter(child => child.tagName === 'K-SORTABLE-ITEM' && !child.hasAttribute('sorting'));
    if (items.length === 0) return null;

    const cursorY = event.clientY;
    if (cursorY < items[0].getBoundingClientRect().top) {
      return [items[0], 'before'];
    }
    if (cursorY > items[items.length - 1].getBoundingClientRect().bottom) {
      return [items[items.length - 1], 'after'];
    }

    for (const item of items) {
      const rect = item.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      if (cursorY < middleY) {
      return [item, 'before'];
      } else if (cursorY < rect.bottom) {
      return [item, 'after'];
      }
    }
    return null;
  }
}
window.customElements.define('k-sortable', Sortable);

export class SortableItem extends Component {
  constructor(){
    super();

    /* Private Methods */
    this[dragStartHandler] = () => {
      this.sorting = true;
    }
    this[dragMoveHandler] = ({y}) => {
      this.style.transform = `translateY(${y}px)`;
      this.style.zIndex = 9999;
      const [target, position] = this.sortable.getCursorElement();
      Array.from(this.sortable.children).forEach(child => {
        child.classList.remove('target-before', 'target-after');
      });
      if (target) {
        target.classList.add(`target-${position}`);
      }
    }
    this[dragEndHandler] = ({y}) => {
      this.sorting = false;
      this.style.transform = '';
      this.style.zIndex = '';
      const [target, position] = this.sortable.getCursorElement();
      Array.from(this.sortable.children).forEach(child => {
        child.classList.remove('target-before', 'target-after');
      });
      if (target) {
        if (position === 'before') {
          this.sortable.insertBefore(this, target);
        } else if (position === 'after') {
          this.sortable.insertBefore(this, target.nextSibling);
        }
        dispatchEvent(this.sortable, 'sort');
      }
    }


    /* Init */
    this.registerAttributes({
      sorting: false
    });
  }

  /* Lifecycle Callbacks */
  async render(force = false){
    if(await super.render(force)){
      const $handle = this.shadowRoot.getElementById('handle');
      this[cleanup] = drag({
        element: $handle,
        startCallback: this[dragStartHandler],
        moveCallback: this[dragMoveHandler],
        endCallback: this[dragEndHandler]
      });
      return true;
    }
    return false;
  }

  /* Protected Members */
  get sortable(){
    return this.closest('k-sortable');
  }


  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <div id="handle">
        <k-icon name="drag-handle"></k-icon>
      </div>
      <div id="content" class="p pl0">
        ${super.shadowTemplate}
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        border: 1px solid var(--c_border);
        user-select: none;
        position: relative;
      }
      :host([sorting]){
       opacity: 0.8;
      }
      #handle {
        display: inline-block;
        cursor: pointer;
        padding: var(--spacer);
      }
      #content {
      display: inline-block;
      }
      :host(.target-before)::before,
      :host(.target-after)::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        height: 4px;
        background-color: var(--c_primary);
      }
      :host(.target-before)::before {
        top: -2px;
      }
      :host(.target-after)::after {
        bottom: -2px;
      }
    `;
  }
}
window.customElements.define('k-sortable-item', SortableItem);
