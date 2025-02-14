import Component from './Component.js';
import Icon from './Icon.js';
import SelectCount from './tableControls/SelectCount.js';
import PageSelect from './tableControls/PageSelect.js';
import PageSize from './tableControls/PageSize.js';
import DeleteSelected from './tableControls/DeleteSelected.js';
import { toTitleCase } from '../utils/string.js';
import { onEvent, dispatchEvent } from '../utils/element.js';

export default class Table extends Component {
  static controls = {
    prevPage: {
      render: (table) => {
        const $button = document.createElement('button');
        $button.classList.add('pq', 'no-btn');
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
        $button.classList.add('pq', 'no-btn');
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
    selectCount: {
      render: (table) => new SelectCount(table)
    },
    deleteSelected: {
      render: (table) => new DeleteSelected(table)
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
    enableSelection = false,
  } = {}) {
    super();

    this.registerProps({
      fields: fields,
      records: records,
      controls: controls,
      pageSize,
      pageSizeOptions,
      currentPage,
      enableSelection,
      selectedIndexes: [], // Renamed property
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
    const selectionControl = this.enableSelection ? '<th class="selection"><input type="checkbox" id="select-all"></th>' : '';
    this.shadowRoot.getElementById('fields').innerHTML = `${selectionControl}${beforeControls}${this.fields.map(({label})=>`<th>${label}</th>`).join('')}${afterControls}`;

    if (this.enableSelection) {
      const selectAllCheckbox = this.shadowRoot.getElementById('select-all');
      selectAllCheckbox.addEventListener('change', () => {
        if (selectAllCheckbox.checked) {
          this.selectAllOnPage();
        } else {
          this.deselectAllOnPage();
        }
      });
      onEvent(this, 'selectionChange pageChange', () => {
        if(this.allOnPageSelected()){
          selectAllCheckbox.checked = true;
        } else {
          selectAllCheckbox.checked = false;
        }
      });
    }
  }
  renderRecords(){
    if(!this.rendered) return;
    const $records = this.shadowRoot.getElementById('records');
    $records.innerHTML = '';
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const paginatedRecords = this.records.slice(start, end);
    let fetchRecords = false;
    paginatedRecords.forEach((record, index) => {
      const $tr = document.createElement('tr');
      if (this.enableSelection) {
        const $td = document.createElement('td');
        $td.classList.add('selection');
        const $checkbox = document.createElement('input');
        $checkbox.type = 'checkbox';
        $checkbox.checked = this.selectedIndexes.includes(start + index);
        $checkbox.addEventListener('change', () => {
          if ($checkbox.checked) {
            this.selectedIndexes.push(start + index);
          } else {
            this.selectedIndexes = this.selectedIndexes.filter(i => i !== start + index);
          }
          dispatchEvent(this, 'selectionChange', { selectedIndexes: this.selectedIndexes });
        });
        $td.appendChild($checkbox);
        $tr.appendChild($td);
      }
      if(this.controls?.before?.length){
        $tr.appendChild(this.renderRowControls(this.controls.before, record, start + index));
      }
      if(record === null){
        const $td = document.createElement('td');
        $td.colSpan = this.fields.length;
        $td.innerHTML = '<i>Loading...</i>';
        fetchRecords = true;
        $tr.appendChild($td);
      } else {
        this.fields.forEach(({name, formatter, calculator}, index) => {
          const $td = document.createElement('td');
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
          $tr.appendChild($td);
        });
      }
      if(this.controls?.after?.length){
        $tr.appendChild(this.renderRowControls(this.controls.after, record, start + index));
      }
      $records.appendChild($tr);
    });
    if(fetchRecords){
      dispatchEvent(this, 'fetchRecords', { start, end });
    }
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
        $button.classList.add('pq', 'no-btn');
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
        $button.classList.add('pq', 'no-btn');
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
    currentPage = false,
    enableSelection = false // Add enableSelection property
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
    if(enableSelection !== undefined){
      this.enableSelection = enableSelection;
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
      // Deselect the record before deleting
      this.selectedIndexes = this.selectedIndexes.filter(i => i !== index);
      dispatchEvent(this, 'selectionChange', { selectedIndexes: this.selectedIndexes });
      this.records.splice(index, 1);
      this.renderRecords();
      dispatchEvent(this, 'recordDeleted', { index });
    }
  }

  getSelectedRecords() {
    return this.selectedIndexes.map(index => this.records[index]);
  }

  selectAllOnPage() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.records.length);
    for (let i = start; i < end; i++) {
      if (!this.selectedIndexes.includes(i)) {
        this.selectedIndexes.push(i);
      }
    }
    this.renderRecords();
    dispatchEvent(this, 'selectionChange', { selectedIndexes: this.selectedIndexes });
  }

  deselectAllOnPage() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.records.length);
    this.selectedIndexes = this.selectedIndexes.filter(index => index < start || index >= end);
    this.renderRecords();
    dispatchEvent(this, 'selectionChange', { selectedIndexes: this.selectedIndexes });
  }

  allOnPageSelected() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.records.length);
    for (let i = start; i < end; i++) {
      if (!this.selectedIndexes.includes(i)) {
        return false;
      }
    }
    return true;
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
      th.selection, td.selection {
        width: 50px;
      }
      th.selection input,
      td.selection input {
        margin: 0;
        width: 1.35rem;
        height: 1.35rem;
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
