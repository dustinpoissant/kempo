import Component from '../Component.js';
import { onEvent, offEvent } from '../../utils/element.js';

const table = Symbol('table'),
      updateOptions = Symbol('updateOptions'),
      changeHandler = Symbol('changeHandler'),
      pageSizeChangeHandler = Symbol('pageSizeChangeHandler');
export default class PageSize extends Component {
  constructor(_table) {
    super();

    /* Private Members */
    this[table] = _table;

    /* Private Methods */
    this[updateOptions] = (()=>{
      const $select = this.shadowRoot.getElementById('pageSizeSelect');
      const options = this[table].pageSizeOptions;
      options.forEach(size => {
        const $option = document.createElement('option');
        $option.value = size;
        $option.textContent = size;
        $select.appendChild($option);
      });
      $select.value = this[table].pageSize;
    }).bind(this);
    this[changeHandler] = (()=>{
      this[table].setPageSize(parseInt(this.shadowRoot.getElementById('pageSizeSelect').value));
    }).bind(this);
    this[pageSizeChangeHandler] = (()=>{
      this.shadowRoot.getElementById('pageSizeSelect').value = this[table].pageSize;
    }).bind(this);

    /* Init */
    this.classList.add('mxq');
  }

  async render(force = false) {
    if(await super.render(force)){
      onEvent(this.shadowRoot.getElementById('pageSizeSelect'), 'change', this[changeHandler]);
      onEvent(this[table], 'pageSizeChange', this[pageSizeChangeHandler]);
      this[updateOptions]();
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('pageSizeSelect'), 'change', this[changeHandler]);
    offEvent(this[table], 'pageSizeChange', this[pageSizeChangeHandler]);
  }

  get shadowTemplate() {
    return /*html*/`
      <label for="pageSizeSelect">Page Size: </label>
      <select id="pageSizeSelect" class="mxq"></select>
    `;
  }

  get shadowStyles() {
    return /*css*/`
      :host {
        display: inline-flex;
        width: max-content;
        align-items: baseline;
      }
      label {
        white-space: nowrap;
      }
    `;
  }
}
window.customElements.define('k-table-page-size', PageSize);
