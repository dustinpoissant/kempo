import Component from '../Component.js';
import { onEvent } from '../../utils/element.js';

export default class PageSize extends Component {
  constructor(table) {
    super();
    this.table = table;
    this.classList.add('mxq');
  }

  async render() {
    if(await super.render()){
      const $select = this.shadowRoot.getElementById('pageSizeSelect');
      const options = this.table.pageSizeOptions;
      options.forEach(size => {
        const $option = document.createElement('option');
        $option.value = size;
        $option.textContent = size;
        $select.appendChild($option);
      });
      $select.value = this.table.pageSize;

      onEvent($select, 'change', () => {
        this.table.setPageSize(parseInt($select.value));
      });

      onEvent(this.table, 'pageSizeChange', () => {
        $select.value = this.table.pageSize;
      });

      return true;
    }
    return false;
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
