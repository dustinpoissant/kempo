import Component from '../Component.js';
import { offEvent, onEvent } from '../../utils/element.js';

const table = Symbol('table'),
      clickHandler = Symbol('clickHandler');
export default class HiddenCount extends Component {
  constructor(_table) {
    super();

    /* Private Members */
    this[table] = _table;

    /* Private Methods */
    this[clickHandler] = (()=>{
      this[table].showAllRecords();
    }).bind(this);

    this.classList.add('mxq');
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

  get shadowTemplate() {
    return /*html*/`
      <button id="showAllButton" class="pq no-btn">
        <k-icon name="show"></k-icon>
      </button>
    `;
  }
}
window.customElements.define('k-table-show-all', HiddenCount);