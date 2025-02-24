import TableControl from './TableControl.js';
import { offEvent, onEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler');
export default class HiddenCount extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[clickHandler] = (()=>{
      this.table.showAllRecords();
    }).bind(this);

    
  }
  async render(force = false) {
    if (await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('showAllButton'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('showAllButton'), 'click', this[clickHandler]);
  }

  /* Shadow DOM */
  get shadowTemplate() {
    return /*html*/`
      <button id="showAllButton" class="no-btn icon-btn">
        <k-icon name="show"></k-icon>
      </button>
    `;
  }
}
window.customElements.define('k-tc-show-all', HiddenCount);