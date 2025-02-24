import TableControl from './TableControl.js';
import { offEvent, onEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler');

export default class Hide extends TableControl {
  constructor() {
    super();
    
    /* Private Methods */
    this[clickHandler] = (()=>{
      const table = this.table;
      const record = this.record;
      if(table && record){
        table.hideRecord(record);
      }
    }).bind(this);
  }
  async render(force = false) {
    if (await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('hideButton'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('hideButton'), 'click', this[clickHandler]);
  }

  /* Shadow DOM */
  get shadowTemplate() {
    return /*html*/`
      <button id="hideButton" class="no-btn icon-btn">
        <k-icon name="hide"></k-icon>
      </button>
    `;
  }
}
window.customElements.define('k-tc-hide', Hide);