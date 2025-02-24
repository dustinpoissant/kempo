import TableControl from './TableControl.js';
import { onEvent, offEvent } from '../../utils/element.js';

const deleteSelected = Symbol('deleteSelected'),
      updateButtonState = Symbol('updateButtonState');
export default class DeleteSelected extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[deleteSelected] = this.deleteSelected.bind(this);
    this[updateButtonState] = (()=>{
      this.shadowRoot.getElementById('deleteSelectedButton').disabled = this.table.getSelectedRecords().length === 0;
    }).bind(this);


    /* Init */
    
  }

  /* Lifecycle Callbacks */
  async render(force = false) {
    if (await super.render(force)) {
      this[updateButtonState]();
      onEvent(this.shadowRoot.getElementById('deleteSelectedButton'), 'click', this[deleteSelected]);
      onEvent(this.table, 'selectionChange', this[updateButtonState]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('deleteSelectedButton'), 'click', this[deleteSelected]);
    offEvent(this.table, 'selectionChange', this[updateButtonState]);
  }

  /* Public Methods */
  deleteSelected() {
    this.table.deleteSelected();
    this[updateButtonState]();
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
      #deleteSelectedButton {
        display: flex;
        align-items: center;
      }
      #deleteSelectedButton:disabled,
      #deleteSelectedButton[disabled] {
        cursor: not-allowed;
        opacity: 0.5;
      }
    `;
  }
}
window.customElements.define('k-table-delete-selected', DeleteSelected);
