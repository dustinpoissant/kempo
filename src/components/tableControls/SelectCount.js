import Component from '../Component.js';
import { onEvent } from '../../utils/element.js';

export default class SelectCount extends Component {
  constructor(table) {
    super();
    this.table = table;
    this.classList.add('mxq');
  }

  async render() {
    if (await super.render()) {
      this.updateCount();
      onEvent(this.table, 'selectionChange', () => {
        this.updateCount();
      });
      return true;
    }
    return false;
  }

  updateCount() {
    const $count = this.shadowRoot.getElementById('selectCount');
    $count.textContent = this.table.getSelectedRecords().length;
  }

  get shadowTemplate() {
    return /*html*/`
      Selected: <span id="selectCount"></span>
    `;
  }

  get shadowStyles() {
    return /*css*/`
      :host {
        display: inline-flex;
        width: max-content;
        align-items: baseline;
        align-self: center;
      }
      label {
        white-space: nowrap;
      }
    `;
  }
}
window.customElements.define('k-table-select-count', SelectCount);
