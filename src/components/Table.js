import Component from './Component.js';
import Icon from './Icon.js'; // Import Icon component
import { toTitleCase } from '../utils/string.js';

export default class Table extends Component {
  constructor(data = false, fields = false, controls = { before: [], after: [], top: [], bottom: [] }){
    super();

    this.registerProps({
      fields: [],
      records: [],
      controls: { before: [], after: [], top: [], bottom: [] }
    });

    /* Init */
    if(data){
      this.setData(data, fields, controls);
    }
  }
  async render(force){
    if(await super.render(force)){
      this.renderControls(this.controls.top, 'top');
      this.renderFields();
      this.renderRecords();
      this.renderControls(this.controls.bottom, 'bottom');
      return true;
    }
    return false;
  }
  renderFields(){
    const beforeControls = this.controls?.before?.length ? '<th></th>' : '';
    const afterControls = this.controls?.after?.length ? '<th></th>' : '';
    this.shadowRoot.getElementById('fields').innerHTML = `${beforeControls}${this.fields.map(({label})=>`<th>${label}</th>`).join('')}${afterControls}`;
  }
  renderRecords(){
    const $records = this.shadowRoot.getElementById('records');
    $records.innerHTML = '';
    this.records.forEach((record) => {
      const $tr = document.createElement('tr');
      if(this.controls?.before?.length){
        $tr.appendChild(this.renderRowControls(this.controls.before, record));
      }
      this.fields.forEach(({name}) => {
        const $td = document.createElement('td');
        let value = record[name] || '';
        if (Array.isArray(value)) {
          value = value.join(', ');
        }
        $td.innerHTML = value;
        $tr.appendChild($td);
      });
      if(this.controls?.after?.length){
        $tr.appendChild(this.renderRowControls(this.controls.after, record));
      }
      $records.appendChild($tr);
    });
  }
  
  renderRowControls(controls = [], record) {
    const $td = document.createElement('td');
    controls.forEach(({ html, icon, action, render }) => {
      if(html){
        $td.appendChild(document.createRange().createContextualFragment(html));
      } else if(render && typeof(render) === 'function'){
        const rendered = render(this, record);
        if(rendered instanceof HTMLElement){
          $td.appendChild(rendered);
        } else if(typeof(rendered) === 'string'){
          $td.appendChild(document.createRange().createContextualFragment(rendered));
        }
      } else if(icon){
        const $button = document.createElement('button');
        $button.appendChild(new Icon(icon));
        if (action) {
          $button.addEventListener('click', () => action(this, record));
        }
        $td.appendChild($button);
      }
    });
    return $td;
  }

  renderControls(controls = [], position) {
    const $container = document.createElement('div');
    controls.forEach(({ html, icon, action, render }) => {
      if(html){
        $container.appendChild(document.createRange().createContextualFragment(html));
      } else if(render && typeof(render) === 'function'){
        const rendered = render(this);
        if(rendered instanceof HTMLElement){
          $container.appendChild(rendered);
        } else if(typeof(rendered) === 'string'){
          $container.appendChild(document.createRange().createContextualFragment(rendered));
        }
      } else if(icon){
        const $button = document.createElement('button');
        $button.appendChild(new Icon(icon));
        if (action) {
          $button.addEventListener('click', () => action(this));
        }
        $container.appendChild($button);
      }
    });
    this.shadowRoot.getElementById(position).innerHTML = '';
    this.shadowRoot.getElementById(position).appendChild($container);
  }

  setData(records, fields = false, controls = { before: [], after: [], top: [], bottom: [] }){
    this.records = records;
    this.fields = fields || Table.extractFieldsFromRecords(this.records);
    this.controls = controls;
    this.renderControls(this.controls.top, 'top');
    this.renderFields();
    this.renderRecords();
    this.renderControls(this.controls.bottom, 'bottom');
  }

  get shadowTemplate(){
    return /*html*/`
      ${super.shadowTemplate}
      <div class="responsive-table">
        <div id="top"></div>
        <table>
          <thead id="fields"></thead>
          <tbody id="records"></tbody>
        </table>
        <div id="bottom"></div>
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
