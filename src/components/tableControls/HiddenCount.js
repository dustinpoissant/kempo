import Component from '../Component.js';
import { offEvent, onEvent } from '../../utils/element.js';

const table = Symbol('table'),
      record = Symbol('record'),
      hiddenChangeHandler = Symbol('hiddenChangeHandler');
export default class HiddenCount extends Component {
  constructor(_table, _record) {
    super();

    /* Private Members */
    this[table] = _table;
    this[record] = _record;

    /* Private Methods */
    this[hiddenChangeHandler] = (()=>{
      this.shadowRoot.getElementById('hiddenCount').textContent = this[table].getHiddenRecords().length;
    }).bind(this);
    
    /* Init */
    this.classList.add('mq');
  }
  async render(force = false) {
    if (await super.render(force)) {
      this[hiddenChangeHandler]()
      onEvent(this[table], 'recordHidden recordShown', this[hiddenChangeHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this[table], 'recordHidden recordShown', this[hiddenChangeHandler]);
  }

  get shadowTemplate() {
    return /*html*/`
      <span id="hiddenCount"></span> Hidden Records
    `;
  }
}
window.customElements.define('k-table-hidden-count', HiddenCount);