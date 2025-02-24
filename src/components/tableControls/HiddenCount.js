import TableControl from './TableControl.js';
import { offEvent, onEvent } from '../../utils/element.js';

const hiddenChangeHandler = Symbol('hiddenChangeHandler');
export default class HiddenCount extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[hiddenChangeHandler] = (()=>{
      this.shadowRoot.getElementById('hiddenCount').textContent = this.table.getHiddenRecords().length;
    }).bind(this);
    
    /* Init */
    this.classList.add('mq');
  }
  async render(force = false) {
    if (await super.render(force)) {
      this[hiddenChangeHandler]()
      onEvent(this.table, 'recordHidden recordShown', this[hiddenChangeHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.table, 'recordHidden recordShown', this[hiddenChangeHandler]);
  }

  /* Shadow DOM */
  get shadowTemplate() {
    return /*html*/`
      <span id="hiddenCount"></span>&nbsp;Hidden Records
    `;
  }
}
window.customElements.define('k-tc-hidden-count', HiddenCount);