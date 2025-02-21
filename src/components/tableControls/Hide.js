import Component from '../Component.js';
import { offEvent, onEvent } from '../../utils/element.js';

const table = Symbol('table'),
      record = Symbol('record'),
      clickHandler = Symbol('clickHandler');

export default class Hide extends Component {
  constructor(_table, _record) {
    super();

    /* Private Members */
    this[table] = _table;
    this[record] = _record;
    
    /* Private Methods */
    this[clickHandler] = (()=>{
      this[table].hideRecord(this[record]);
    }).bind(this);

    this.classList.add('mxq');
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

  get shadowTemplate() {
    return /*html*/`
      <button id="hideButton" class="pq no-btn">
        <k-icon name="hide"></k-icon>
      </button>
    `;
  }
}
window.customElements.define('k-table-hide', Hide);