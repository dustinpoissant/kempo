import Component from './Component.js';
import Icon from './Icon.js';
import { toTitleCase } from '../utils/string.js';
import { onEvent, dispatchEvent } from '../utils/element.js';

export default class Table extends Component {
  static controls = {
    prevPage: {
      render: (table) => {
        const $button = document.createElement('button');
        $button.classList.add('pq');
        $button.appendChild(new Icon('chevron-left'));
        onEvent($button, 'click', () => table.prevPage());

        // Disable button if on the first page
        onEvent(table, 'pageChange', () => {
          $button.disabled = table.getCurrentPage() === 1;
        });

        return $button;
      }
    },
    nextPage: {
      render: (table) => {
        const $button = document.createElement('button');
        $button.classList.add('pq');
        $button.appendChild(new Icon('chevron-right'));
        onEvent($button, 'click', () => table.nextPage());

        // Disable button if on the last page
        onEvent(table, 'pageChange', () => {
          $button.disabled = table.getCurrentPage() === table.getTotalPages();
        });

        return $button;
      }
    },
    pageSelect: {
      render: (table) => new PageSelect(table)
    },
    pageSize: {
      render: (table) => new PageSize(table)
    },
    spacer: {
      html: '<div class="flex"></div>'
    }
  };

  constructor({
    records = [],
    fields = [],
    controls = { before: [], after: [], top: [], bottom: [] },
    pageSize = 100,
    pageSizeOptions = [10, 25, 50, 100, 500],
    currentPage = 1,
  } = {}) {
    super();

    this.registerProps({
      fields: fields,
      records: records,
      controls: controls,
      pageSize,
      pageSizeOptions,
      currentPage,
    });

    /* Init */
    // 
  }
  async render(force){
    if(await super.render(force)){
      this.setData({
        records: this.records,
        fields: this.fields,
        controls: this.controls,
        pageSize: this.pageSize,
        pageSizeOptions: this.pageSizeOptions,
        currentPage: this.currentPage
      });
      return true;
    }
    return false;
  }
  renderFields(){
    if(!this.rendered) return;
    const beforeControls = this.controls?.before?.length ? '<th></th>' : '';
    const afterControls = this.controls?.after?.length ? '<th></th>' : '';
    this.shadowRoot.getElementById('fields').innerHTML = `${beforeControls}${this.fields.map(({label})=>`<th>${label}</th>`).join('')}${afterControls}`;
  }
  renderRecords(){
    if(!this.rendered) return;
    const $records = this.shadowRoot.getElementById('records');
    $records.innerHTML = '';
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const paginatedRecords = this.records.slice(start, end);
    paginatedRecords.forEach((record, index) => {
      const $tr = document.createElement('tr');
      if(this.controls?.before?.length){
        $tr.appendChild(this.renderRowControls(this.controls.before, record, start + index));
      }
      this.fields.forEach(({name, formatter, calculator}) => {
        const $td = document.createElement('td');
        if (record === null) {
          $td.innerHTML = 'Loading...';
            dispatchEvent(this, 'fetchRecords', { start, end });
        } else {
          let value;
          if(calculator){
            value = calculator(record, this);
          } else {
            value = record[name] || '';
            if (Array.isArray(value)) {
              if(formatter){
                value = value.map(formatter).join(', ');
              } else {
                value = value.join(', ');
              }
            } else {
              if(formatter){
                value = formatter(value);
              }
            }
          }
          $td.innerHTML = value;
        }
        $tr.appendChild($td);
      });
      if(this.controls?.after?.length){
        $tr.appendChild(this.renderRowControls(this.controls.after, record, start + index));
      }
      $records.appendChild($tr);
    });
  }
  
  renderRowControls(controls = [], record, index) {
    if(!this.rendered) return;
    const $td = document.createElement('td');
    controls.forEach(({ html, icon, action, render }) => {
      if(html){
        $td.appendChild(document.createRange().createContextualFragment(html));
      } else if(render && typeof(render) === 'function'){
        const rendered = render(this, record, index);
        if(rendered instanceof HTMLElement){
          $td.appendChild(rendered);
        } else if(typeof(rendered) === 'string'){
          $td.appendChild(document.createRange().createContextualFragment(rendered));
        }
      } else if(icon){
        const $button = document.createElement('button');
        $button.classList.add('pq');
        $button.appendChild(new Icon(icon));
        if (action) {
          onEvent($button, 'click', () => action(this, record, index));
        }
        $td.appendChild($button);
      }
    });
    return $td;
  }

  renderControls(controls = [], position) {
    if(!this.rendered) return;
    const $container = this.shadowRoot.getElementById(position);
    $container.innerHTML = '';
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
        $button.classList.add('pq');
        $button.appendChild(new Icon(icon));
        if (action) {
          onEvent($button, 'click', () => action(this));
        }
        $container.appendChild($button);
      }
    });
  }

  getCurrentPage() {
    return this.currentPage;
  }

  getTotalPages() {
    return Math.ceil(this.records.length / this.pageSize);
  }

  setPage(page) {
    if (page < 1 || page > this.getTotalPages()) return;
    this.currentPage = page;
    this.renderRecords();
    // Trigger page change event
    dispatchEvent(this, 'pageChange');
  }

  nextPage() {
    if (this.currentPage < this.getTotalPages()) {
      this.setPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.setPage(this.currentPage - 1);
    }
  }

  setPageSize(pageSize) {
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.renderRecords();
    // Trigger page size change event
    dispatchEvent(this, 'pageSizeChange');
  }

  setData({
    records = false,
    fields = false,
    controls = false,
    pageSize = false,
    pageSizeOptions = false,
    currentPage = false
  } = {}) {
    let rerender = false;
    let rerenderControls = false;
    if(records){
      this.records = records;
      this.fields = fields || Table.extractFieldsFromRecords(this.records);
      rerender = true;
    }
    if (pageSize) {
      this.pageSize = pageSize;
      rerender = true;
    }
    if (pageSizeOptions) {
      this.pageSizeOptions = pageSizeOptions;
    }
    if (controls) {
      this.controls = controls;
      rerenderControls = true;
    }
    if(currentPage){
      this.currentPage = currentPage;
      rerender = true;
    }
    if(rerender){
      this.renderFields();
      this.renderRecords();
    }
    if(rerenderControls){
      this.renderControls(this.controls.top, 'top');
      this.renderControls(this.controls.bottom, 'bottom');
    }
  }

  setRecords(records) {
    this.records = records;
    this.currentPage = 1;
    this.renderRecords();
    dispatchEvent(this, 'recordsSet', { records });
  }

  setupFetchRecords(totalRecords, callback) {
    const previousLength = this.records.length;
    if (previousLength < totalRecords) {
      this.records.length = totalRecords;
      this.records.fill(null, previousLength);
    }

    onEvent(this, 'fetchRecords', async (event) => {
      const { start, end } = event.detail;
      const records = await callback(start, end - start);
      this.records.splice(start, records.length, ...records);
      this.renderRecords();
    });
  }

  addRecord(record) {
    this.records.push(record);
    this.renderRecords();
    dispatchEvent(this, 'recordAdded', { record });
  }

  updateRecord(index, newRecord) {
    this.records[index] = newRecord;
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    if (index >= start && index < end) {
      this.renderRecords();
    }
  }

  deleteRecord(index) {
    if (index >= 0 && index < this.records.length) {
      this.records.splice(index, 1);
      this.renderRecords();
      dispatchEvent(this, 'recordDeleted', { index });
    }
  }

  get shadowTemplate(){
    return /*html*/`
      ${super.shadowTemplate}
      <div class="responsive-table">
        <div id="top"></div>
        <table class="b0">
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
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
      }
      #top, #bottom {
        display: flex;
      }
      th {
        border-top: none;
      }
      tr:last-child td:first-child {
        border-bottom-left-radius: 0;
      }
      tr:last-child td:last-child {
        border-bottom-right-radius: 0;
      }
      tr:last-child td {
        border-bottom: none;
      }
      th:first-child, td:first-child {
        border-left: none;
      }
      th:last-child, td:last-child {
        border-right: none;
      }
      #top:not(:empty) {
        border-bottom: 1px solid var(--c_border);
      }
      #bottom:not(:empty) {
        border-top: 1px solid var(--c_border);
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

class PageSelect extends Component {
  constructor(table) {
    super();
    this.table = table;
    this.classList.add('mxq');
  }

  connectedCallback() {
    this.render();
  }

  async render() {
    if(await super.render()){
      this.updateOptions();
      return true;
    }
    return false;
  }

  updateOptions() {
    const $select = this.shadowRoot.getElementById('pageSelect');
    $select.innerHTML = '';
    for (let i = 1; i <= this.table.getTotalPages(); i++) {
      const $option = document.createElement('option');
      $option.value = i;
      $option.textContent = i;
      $select.appendChild($option);
    }
    $select.value = this.table.getCurrentPage();
    const $totalPages = this.shadowRoot.getElementById('totalPages');
    $totalPages.textContent = this.table.getTotalPages();

    onEvent($select, 'change', () => {
      this.table.setPage(parseInt($select.value));
    });

    onEvent(this.table, 'pageSizeChange', () => {
      this.updateOptions();
    });

    onEvent(this.table, 'pageChange', () => {
      $select.value = this.table.getCurrentPage();
    });
  }

  get shadowTemplate() {
    return /*html*/`
      <select id="pageSelect" class="mxq"></select>
      <label> out of <span id="totalPages"></span></label>
    `;
  }

  get shadowStyles() {
    return /*css*/`
      :host {
        display: inline-flex;
        width: max-content;
        align-items: baseline;
      }
      #pageSelect, label {
        display: inline;
      }
      label {
        white-space: nowrap;
      }
    `;
  }
}
window.customElements.define('k-table-page-select', PageSelect);

class PageSize extends Component {
  constructor(table) {
    super();
    this.table = table;
    this.classList.add('mxq');
  }

  connectedCallback() {
    this.render();
  }

  async render() {
    if(await super.render()){
      const $select = this.shadowRoot.getElementById('pageSizeSelect');
      const options = this.table.pageSizeOptions;
      options.forEach(size => {
        const $option = document.createElement('option');
        $option.value = size;
        $option.textContent = size;
        $select.appendChild($option);
      });
      $select.value = this.table.pageSize;

      onEvent($select, 'change', () => {
        this.table.setPageSize(parseInt($select.value));
      });

      onEvent(this.table, 'pageSizeChange', () => {
        $select.value = this.table.pageSize;
      });

      return true;
    }
    return false;
  }

  get shadowTemplate() {
    return /*html*/`
      <label for="pageSizeSelect">Page Size: </label>
      <select id="pageSizeSelect" class="mxq"></select>
    `;
  }

  get shadowStyles() {
    return /*css*/`
      :host {
        display: inline-flex;
        width: max-content;
        align-items: baseline;
      }
      label {
        white-space: nowrap;
      }
    `;
  }
}
window.customElements.define('k-table-page-size', PageSize);
