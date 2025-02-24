import TableControl from './TableControl.js';
import '../Icon.js';
import { onEvent, offEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler');
export default class ExportCsv extends TableControl {
  constructor() {
    super({
      maxWidth: 136
    });
  
    /* Private Methods */
    this[clickHandler] = this.export.bind(this);
  }

  /* Lifecycle Callbacks */
  async render(force = false){
    if(await super.render(force)){
      onEvent(this.shadowRoot.getElementById('export'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('export'), 'click', this[clickHandler]);
  }

  /* Public Methods */
  getCSV(){
    const table = this.table;
    let csv = '';
    if(table){
      const fields = [];
      table.fields.forEach( ({name, calculator}) => {
        if(!calculator){
          fields.push(name);
        }
      });
      csv += fields.join(',') + '\n';
      if(this.record){
        const record = this.record;
        const row = [];
        fields.forEach( field => {
          row.push(record[field]);
        });
        csv += row.join(',') + '\n';
      } else {
        table.records.forEach( record => {
          const row = [];
          fields.forEach( field => {
            row.push(record[field]);
          });
          csv += row.join(',') + '\n';
        });
      }
    }
    return csv;
  }
  export(){
    const data = this.getCSV();
    const record = this.record;
    if(record){
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button id="export" class="no-btn ph">
        <slot><k-icon name="export-file"></k-icon> Export CSV</slot>
      </button>
    `;
  }
}
window.customElements.define('k-tc-export-csv', ExportCsv);