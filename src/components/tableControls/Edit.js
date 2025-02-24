import TableControl from './TableControl.js';
import { offEvent, onEvent } from '../../utils/element.js';

const editRecord = Symbol('editRecord'),
      saveRecord = Symbol('saveRecord'),
      cancelEdit = Symbol('cancelEdit');
export default class Edit extends TableControl {
  constructor() {
    super();

    
    /* Private Methods */
    this[editRecord] = this.editRecord.bind(this);
    this[saveRecord] = this.saveRecord.bind(this);
    this[cancelEdit] = this.cancelEdit.bind(this);

    /* Init */
    this.registerAttributes({
      editing: false
    });
    this.maxWidth = 80;
  }
  async render(force = false) {
    if (await super.render(force)) {
      const record = this.record;
      if(record){
        this.editing = this.table.recordIsEditing(record)
      }
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

  /* Public Methods */
  editRecord() {
    this.table.editRecord(this.record);
  }
  saveRecord() {
    this.table.saveEditedRecord(this.record);
  }
  cancelEdit() {
    this.table.cancelEditedRecord(this.record);
  }

  get shadowTemplate() {
    return /*html*/`
      <button id="editButton" class="icon-btn no-btn">
        <k-icon name="edit"></k-icon>
      </button>
      <button id="saveButton" class="icon-btn no-btn bg-success">
        <k-icon name="check"></k-icon>
      </button>
      <button id="cancelButton" class="icon-btn no-btn bg-danger">
        <k-icon name="close"></k-icon>
      </button>
    `;
  }

  get shadowStyles() {
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: inline-flex;
        width: max-content;
        align-items: baseline;
      }
      :host([editing]) #editButton,
      :host(:not([editing])) #cancelButton,
      :host(:not([editing])) #saveButton {
        display: none !important;
      }
    `;
  }
}
window.customElements.define('k-tc-edit', Edit);
