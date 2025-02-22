import Component from '../Component.js';
import { offEvent, onEvent } from '../../utils/element.js';
import debounce from '../../utils/debounce.js';

const table = Symbol('table'),
      changeHandler = Symbol('changeHandler');
export default class Search extends Component {
  constructor(_table) {
    super();

    /* Private Members */
    this[table] = _table;

    /* Private Methods */
    this[changeHandler] = debounce(this.search.bind(this), 200);

    /* Init */
    this.classList.add('mxq');
  }

  /* Lifecycle Callbacks */
  async render(force = false) {
    if (await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('search'), 'input', this[changeHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('search'), 'input', this[changeHandler]);
  }

  /* Public Methods */
  search() {
    const term = this.shadowRoot.getElementById('search').value;
    if (term.length < 3) {
      this[table].showAllRecords();
    } else {
      this[table].search(term);
    }
  }

  get shadowTemplate(){
    return /*html*/`
      <input
        id="search"
        type="search"
        placeholder="Search"
        class="px pyh"
      />
    `;
  }
}
window.customElements.define('k-table-search', Search);
