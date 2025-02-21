import Component from '../Component.js';
import { onEvent } from '../../utils/element.js';

const table = Symbol('table'),
      updateOptions = Symbol('updateOptions'),
      handleSelectChange = Symbol('handleSelectChange'),
      handlePageSizeChange = Symbol('handlePageSizeChange'),
      handlePageChange = Symbol('handlePageChange'),
      handlePageCountChange = Symbol('handlePageCountChange');
export default class PageSelect extends Component {
  constructor(_table) {
    super();

    /* Private Members */
    this[table] = _table;

    /* Private Methods */
    this[updateOptions] = (()=>{
      const $select = this.shadowRoot.getElementById('pageSelect');
      $select.innerHTML = '';
      for (let i = 1; i <= this[table].getTotalPages(); i++) {
        const $option = document.createElement('option');
        $option.value = i;
        $option.textContent = i;
        $select.appendChild($option);
      }
      $select.value = this[table].getCurrentPage();
      this.shadowRoot.getElementById('totalPages').textContent = this[table].getTotalPages();
    }).bind(this);
    this[handleSelectChange] = (() => {
      this[table].setPage(parseInt(this.shadowRoot.getElementById('pageSelect').value));
    }).bind(this);
    this[handlePageSizeChange] = (() => {
      this[updateOptions]();
      this.shadowRoot.getElementById('pageSelect').value = this[table].getCurrentPage();
    }).bind(this);
    this[handlePageChange] = (() => {
      this.shadowRoot.getElementById('pageSelect').value = this[table].getCurrentPage();
    }).bind(this);
    this[handlePageCountChange] = (() => {
      this.shadowRoot.getElementById('totalPages').textContent = this[table].getTotalPages();
      this[updateOptions]();
    }).bind(this);
    
    /* Init */
    this.classList.add('mxq');
  }

  async render(force = false) {
    if(await super.render(force)){
      const $select = this.shadowRoot.getElementById('pageSelect');
      onEvent($select, 'change', this[handleSelectChange]);
      onEvent(this[table], 'pageSizeChange', this[handlePageSizeChange]);
      onEvent(this[table], 'pageChange pageCountChanged', this[handlePageChange]);
      onEvent(this[table], 'pageCountChanged',  this[handlePageCountChange]);
      this[updateOptions]();
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('pageSelect'), 'change', this[handleSelectChange]);
    offEvent(this[table], 'pageSizeChange', this[handlePageSizeChange]);
    offEvent(this[table], 'pageChange pageCountChanged', this[handlePageChange]);
    offEvent(this[table], 'pageCountChanged',  this[handlePageCountChange]);
  }

  get shadowTemplate() {
    return /*html*/`
      <select id="pageSelect" class="mxq"></select>
      <label> out of <span id="totalPages"></span></label>
    `;
  }

  get shadowStyles() {
    return /*css*/`
      :host {
        display: inline-flex;
        width: max-content;
        align-items: baseline;
      }
      #pageSelect, label {
        display: inline;
      }
      label {
        white-space: nowrap;
      }
    `;
  }
}
window.customElements.define('k-table-page-select', PageSelect);
