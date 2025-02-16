import Component from '../Component.js';
import { onEvent } from '../../utils/element.js';

export default class PageSelect extends Component {
  constructor(table) {
    super();
    this.table = table;
    this.classList.add('mxq');
  }

  async render() {
    if(await super.render()){
      this.updateOptions();
      return true;
    }
    return false;
  }

  updateOptions() {
    const $select = this.shadowRoot.getElementById('pageSelect');
    $select.innerHTML = '';
    for (let i = 1; i <= this.table.getTotalPages(); i++) {
      const $option = document.createElement('option');
      $option.value = i;
      $option.textContent = i;
      $select.appendChild($option);
    }
    $select.value = this.table.getCurrentPage();
    const $totalPages = this.shadowRoot.getElementById('totalPages');
    $totalPages.textContent = this.table.getTotalPages();

    onEvent($select, 'change', () => {
      this.table.setPage(parseInt($select.value));
    });

    onEvent(this.table, 'pageSizeChange', () => {
      this.updateOptions();
      $select.value = this.table.getCurrentPage();
    });

    onEvent(this.table, 'pageChange pageCountChanged', () => {
      $select.value = this.table.getCurrentPage();
    });

    onEvent(this.table, 'pageCountChanged', () => {
      $totalPages.textContent = this.table.getTotalPages();
    });
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
