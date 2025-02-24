import TableControl from './TableControl.js';
import { offEvent, onEvent } from '../../utils/element.js';
import debounce from '../../utils/debounce.js';

const changeHandler = Symbol('changeHandler');
export default class Search extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[changeHandler] = debounce(this.search.bind(this), 200);
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
      this.table.showAllRecords();
    } else {
      this.table.search(term);
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
      ${super.shadowTemplate}
    `;
  }
}
window.customElements.define('k-tc-search', Search);
