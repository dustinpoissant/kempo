import Component from '../Component.js';
import { onEvent } from '../../utils/element.js';

export default class DeleteSelected extends Component {
  constructor(table) {
    super();
    this.table = table;
    this.classList.add('mxq');
  }

  async render() {
    if (await super.render()) {
      this.updateButtonState();
      const $button = this.shadowRoot.getElementById('deleteSelectedButton');
      onEvent($button, 'click', () => this.deleteSelected());
      onEvent(this.table, 'selectionChange', () => this.updateButtonState());
      return true;
    }
    return false;
  }

  deleteSelected() {
    const selectedIndexes = this.table.selectedIndexes;
    selectedIndexes.sort((a, b) => b - a); // Sort in descending order
    selectedIndexes.forEach(index => this.table.deleteRecord(index));
    this.table.selectedIndexes = [];
    this.table.renderRecords();
    this.updateButtonState();
  }

  updateButtonState() {
    const $button = this.shadowRoot.getElementById('deleteSelectedButton');
    $button.disabled = this.table.selectedIndexes.length === 0;
  }

  get shadowTemplate() {
    return /*html*/`
      <button id="deleteSelectedButton" class="pq no-btn">
        <k-icon name="delete"></k-icon>
      </button>
    `;
  }

  get shadowStyles() {
    return /*css*/`
      :host {
        display: inline-flex;
        width: max-content;
        align-items: baseline;
      }
      button {
        display: flex;
        align-items: center;
      }
    `;
  }
}
window.customElements.define('k-table-delete-selected', DeleteSelected);
