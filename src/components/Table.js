import Component from './Component.js';
import { toTitleCase } from '../utils/string.js';

export default class Table extends Component {
  constructor(data = false, fields = false){
    super();

    this.registerProps({
      fields: [],
      records: []
    });

    /* Init */
    if(data){
      this.setData(data, fields);
    }
  }
  async render(force){
    if(await super.render(force)){
      this.renderFields();
      this.renderRecords();
      return true;
    }
    return false;
  }
  renderFields(){
    this.shadowRoot.getElementById('fields').innerHTML = this.fields.map(({label})=>`<th>${label}</th>`).join('');
  }
  renderRecords(){
    this.shadowRoot.getElementById('records').innerHTML = this.records.map((record) => {
      return `<tr>${this.fields.map(({name})=>`<td>${record[name] || ''}</td>`).join('')}</tr>`;
    }).join('');
  }
  
  setData(records, fields = false){
    this.records = records;
    this.fields = fields || Table.extractFieldsFromRecords(this.records);
    this.renderFields();
    this.renderRecords();
  }

  get shadowTemplate(){
    return /*html*/`
      ${super.shadowTemplate}
      <div class="responsive-table">
        <table>
          <thead id="fields"></thead>
          <tbody id="records"></tbody>
        </table>
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        margin-bottom: var(--spacer);
      }
    `;
  }

  static extractFieldsFromRecords(records, recordLimit = 100){
    const names = new Set();
    records.slice(0, recordLimit).forEach( record => {
      Object.keys(record).forEach( name => names.add(name) )
    });
    return [...names].map(name=>({name,label:toTitleCase(name)}));
  }
}
window.customElements.define('k-table', Table);
