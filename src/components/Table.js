import Component from './Component.js';
import Icon from './Icon.js'; // Import Icon component
import { toTitleCase } from '../utils/string.js';

export default class Table extends Component {
  constructor(data = false, fields = false, controls = { before: [], after: [] }){
    super();

    this.registerProps({
      fields: [],
      records: [],
      controls: { before: [], after: [] }
    });

    /* Init */
    if(data){
      this.setData(data, fields, controls);
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
    const beforeControls = this.controls.before?.length ? '<th></th>' : '';
    const afterControls = this.controls.after?.length ? '<th></th>' : '';
    this.shadowRoot.getElementById('fields').innerHTML = `${beforeControls}${this.fields.map(({label})=>`<th>${label}</th>`).join('')}${afterControls}`;
  }
  renderRecords(){
    this.shadowRoot.getElementById('records').innerHTML = this.records.map((record) => {
      return `<tr>${this.renderControls(this.controls.before, record)}${this.fields.map(({name}) => {
        let value = record[name] || '';
        if (Array.isArray(value)) {
          value = value.join(', ');
        }
        return `<td>${value}</td>`;
      }).join('')}${this.renderControls(this.controls.after, record)}</tr>`;
    }).join('');
  }
  
  renderControls(controls = [], record) {
    if (controls.length === 0) return '';
    return `<td>${controls.map(({ icon, action }) => {
      const button = document.createElement('button');
      const iconElement = new Icon(icon); // Pass icon name as parameter
      button.appendChild(iconElement);
      button.addEventListener('click', () => action(record, this));
      return button.outerHTML;
    }).join('')}</td>`;
  }

  setData(records, fields = false, controls = { before: [], after: [] }){
    this.records = records;
    this.fields = fields || Table.extractFieldsFromRecords(this.records);
    this.controls = controls;
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
