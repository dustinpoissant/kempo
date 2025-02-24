import TableControl from './TableControl.js';
import '../Icon.js';
import { onEvent, offEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler');
export default class DeleteRecord extends TableControl {
  constructor() {
    super();
  
    /* Private Methods */
    this[clickHandler] = this.delete.bind(this);
  }

  /* Lifecycle Callbacks */
  async render(force = false){
    if(await super.render(force)){
      onEvent(this.shadowRoot.getElementById('delete'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('delete'), 'click', this[clickHandler]);
  }

  /* Public Methods */
  delete(){
    if(this.record){
      this.table.deleteRecord(this.record)
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button id="delete" class="no-btn icon-btn">
        <slot><k-icon name="delete"></k-icon></slot>
      </button>
    `;
  }
}
window.customElements.define('k-tc-delete-record', DeleteRecord);