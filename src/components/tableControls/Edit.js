import Component from '../Component.js';
import { offEvent, onEvent } from '../../utils/element.js';

const table = Symbol('table'),
      record = Symbol('record'),
      editRecord = Symbol('editRecord'),
      saveRecord = Symbol('saveRecord'),
      cancelEdit = Symbol('cancelEdit');
export default class Edit extends Component {
  constructor(_table, _record) {
    super();

    /* Private Members */
    this[table] = _table;
    this[record] = _record;
    
    /* Private Methods */
    this[editRecord] = this.editRecord.bind(this);
    this[saveRecord] = this.saveRecord.bind(this);
    this[cancelEdit] = this.cancelEdit.bind(this);

    /* Init */
    this.registerAttributes({
      editing: this[table].recordIsEditing(_record)
    });

    this.classList.add('mxq');
  }
  async render(force = false) {
    if (await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('editButton'), 'click', this[editRecord]);
      onEvent(this.shadowRoot.getElementById('saveButton'), 'click', this[saveRecord]);
      onEvent(this.shadowRoot.getElementById('cancelButton'), 'click', this[cancelEdit]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('editButton'), 'click', this[editRecord]);
    offEvent(this.shadowRoot.getElementById('saveButton'), 'click', this[saveRecord]);
    offEvent(this.shadowRoot.getElementById('cancelButton'), 'click', this[cancelEdit]);
  }

  editRecord() {
    this[table].editRecord(this[record]);
  }
  saveRecord() {
    this[table].saveEditedRecord(this[record]);
  }
  cancelEdit() {
    this[table].cancelEditedRecord(this[record]);
  }

  get shadowTemplate() {
    return /*html*/`
      <button id="editButton" class="pq no-btn">
        <k-icon name="edit"></k-icon>
      </button>
      <button id="cancelButton" class="pq no-btn bg-danger">
        <k-icon name="close"></k-icon>
      </button>
      <button id="saveButton" class="pq no-btn bg-success">
        <k-icon name="check"></k-icon>
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
      :host([editing]) #editButton,
      :host(:not([editing])) #cancelButton,
      :host(:not([editing])) #saveButton {
        display: none;
      }
    `;
  }
}
window.customElements.define('k-table-edit', Edit);
