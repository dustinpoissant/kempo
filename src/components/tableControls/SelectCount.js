import TableControl from './TableControl.js';
import { onEvent } from '../../utils/element.js';

export default class SelectCount extends TableControl {
  async render(forced = false) {
    if (await super.render(forced)) {
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

  /* Shadow DOM */
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
