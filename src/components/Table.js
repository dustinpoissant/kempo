import Component from './Component.js';
import Icon from './Icon.js';
import SelectCount from './tableControls/SelectCount.js';
import PageSelect from './tableControls/PageSelect.js';
import PageSize from './tableControls/PageSize.js';
import DeleteSelected from './tableControls/DeleteSelected.js';
import Edit from './tableControls/Edit.js';
import { toTitleCase } from '../utils/string.js';
import { onEvent, offEvent, dispatchEvent } from '../utils/element.js';

const selected = Symbol('selected');
const hidden = Symbol('hidden');
const index = Symbol('index');
const editing = Symbol('editing');

export default class Table extends Component {

  constructor({
    records = [],
    fields = [],
    controls = { before: [], after: [], top: [], bottom: [] },
    enablePages = false,
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
      enablePages,
      sort: []
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
  renderRecords() {
    if (!this.rendered) return;
    const $records = this.shadowRoot.getElementById('records');
    $records.innerHTML = '';
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const paginatedRecords = this.getDisplayedRecords().slice(start, end);
    let fetchRecords = false;
    paginatedRecords.forEach((record) => {
      $records.appendChild(this.renderRecord(record));
    });
    if (fetchRecords) {
      dispatchEvent(this, 'fetchRecords', { start, end });
    }
  }

  renderRecord(record){
    const $tr = document.createElement('tr');
    $tr.dataset.index = record[index];
    if (this.enableSelection) {
      const $td = document.createElement('td');
      $td.classList.add('selection');
      const $checkbox = document.createElement('input');
      $checkbox.type = 'checkbox';
      $checkbox.checked = record[selected];
      $checkbox.addEventListener('change', (event) => {
        record[selected] = !!event.target.checked;
        dispatchEvent(this, 'selectionChange');
      });
      $td.appendChild($checkbox);
      $tr.appendChild($td);
    }
    if (this.controls?.before?.length) {
      $tr.appendChild(this.renderRowControls(this.controls.before, record));
    }
    if (record === null) {
      const $td = document.createElement('td');
      $td.colSpan = this.fields.length;
      $td.innerHTML = '<i>Loading...</i>';
      fetchRecords = true;
      $tr.appendChild($td);
    } else {
      this.fields.forEach(({ name, formatter, calculator, type, editor }) => {
        const $td = document.createElement('td');
        $td.dataset.field = name;
        if (calculator) {
          $td.innerHTML = calculator(record, this);
        } else {
          let value = record[name] || '';
          if(record[editing]){
            $tr.setAttribute('editing', true);
            if(editor){
              $td.appendChild(editor(value));
            } else {
              let editorGen = Table.editors[type || typeof value];
              if(!editorGen){
                editorGen = Table.editors.string;
              }
              $td.appendChild(editorGen(value));
            }
          } else {
            if (Array.isArray(value)) {
              if (formatter) {
                value = value.map(formatter).join(', ');
              } else {
                value = value.join(', ');
              }
            } else {
              if (formatter) {
                value = formatter(value);
              }
            }
            $td.innerHTML = value;
          }
        }
        
        $tr.appendChild($td);
      });
    }
    if (this.controls?.after?.length) {
      $tr.appendChild(this.renderRowControls(this.controls.after, record));
    }
    return $tr;
  }

  editRecord(record){
    record[editing] = true;
    const $currentTr = this.shadowRoot.querySelector(`tr[data-index="${record[index]}"]`);
    const $newTr = this.renderRecord(record);
    $currentTr.replaceWith($newTr);
    dispatchEvent(this, 'editingChange');
  }
  
  saveEditedRecord(record){
    record[editing] = false;
    const $currentTr = this.shadowRoot.querySelector(`tr[data-index="${record[index]}"]`);
    $currentTr.querySelectorAll('td').forEach(($td) => {
      const $input = $td.children.length === 1 ? $td.firstChild : $td.querySelector('input, select');
      if ($input) {
        record[$td.dataset.field] = $input.value;
      }
    });
    const $newTr = this.renderRecord(record);
    $currentTr.replaceWith($newTr);
  }

  cancelEditedRecord(record){
    record[editing] = false;
    const $currentTr = this.shadowRoot.querySelector(`tr[data-index="${record[index]}"]`);
    const $newTr = this.renderRecord(record);
    $currentTr.replaceWith($newTr);
  }

  recordIsEditing(record){
    return record[editing];
  }
  
  renderRowControls(controls = [], record) {
    if(!this.rendered) return;
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
        $button.classList.add('pq', 'no-btn');
        $button.appendChild(new Icon(icon));
        if (action) {
          onEvent($button, 'click', () => action(this, record));
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
    return Math.ceil(this.getDisplayedRecords().length / this.pageSize);
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
    let rerender = false,
        rerenderControls = false,
        pageCountBefore = this.getTotalPages(),
        pageBefore = this.currentPage;
    if(records){
      this.records = records.map(r=>({...r}));
      this.records.forEach((record, idx) => {
        record[index] = idx;
        record[selected] = false;
        record[hidden] = false;
        record[editing] = false;
      });
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
    const newPageCount = this.getTotalPages();
    if(newPageCount !== pageCountBefore){
      dispatchEvent(this, 'pageCountChanged', { totalPages: this.getTotalPages() });
    }
    if(pageBefore > newPageCount){
      this.setPage(newPageCount); 
    }
  }

  setRecords(records) {
    let pageCountBefore = this.getTotalPages(),
        pageBefore = this.currentPage;
    this.records = records.map(r=>({...r}));
    this.records.forEach((record, idx) => {
      record[index] = idx;
      record[selected] = false;
      record[hidden] = false;
      record[editing] = false;
    });
    this.renderRecords();
    dispatchEvent(this, 'recordsSet', { records });
    const newPageCount = this.getTotalPages();
    if(newPageCount !== pageCountBefore){
      dispatchEvent(this, 'pageCountChanged', { totalPages: this.getTotalPages() });
    }
    if(pageBefore > newPageCount){
      this.setPage(newPageCount); 
    }
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
    record[selected] = false;
    record[hidden] = false;
    record[index] = this.records.length;
    this.records.push(record);
    this.renderRecords();
    dispatchEvent(this, 'recordAdded', { record });
  }

  updateRecord(record, newData) {
    let updated = false;
    let originalRecord = this.records.find(r => r === record);
    if (!originalRecord && record[index] !== undefined) {
      originalRecord = this.records[record[index]];
    }
    Object.keys(newData).forEach(key => {
      if (originalRecord.hasOwnProperty(key)) {
        originalRecord[key] = newData[key];
        updated = true;
      }
    });
    if(updated){
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      if (
        !this.enablePages ||
        (originalRecord[index] >= start && originalRecord[index] < end)
      ) {
        this.renderRecords();
      }
    }
  }

  deleteRecord(record) {
    let originalRecord = this.records.find(r => r === record),
        totalPagesBefore = this.getTotalPages();
    if (!originalRecord && record[index] !== undefined) {
      originalRecord = this.records[record[index]];
    }
    if (originalRecord) {
      const recordIndex = this.records.indexOf(originalRecord);
      this.records.splice(recordIndex, 1);
      // Update the index of remaining records
      this.records.forEach((rec, idx) => {
        rec[index] = idx;
      });
      this.renderRecords();
      dispatchEvent(this, 'selectionChange');
      dispatchEvent(this, 'recordDeleted', { index: recordIndex });
      const totalPages = this.getTotalPages();
      if (this.currentPage > totalPages) {
        this.setPage(totalPages);
      }
      if(totalPages !== totalPagesBefore){
        dispatchEvent(this, 'pageCountChanged', { totalPages });
      }
    }
  }

  deleteSelected() {
    let totalPagesBefore = this.getTotalPages();
    const selectedRecords = this.getSelectedRecords();
    selectedRecords.forEach(record => {
      let originalRecord = this.records.find(r => r === record);
      if (!originalRecord && record[index] !== undefined) {
        originalRecord = this.records[record[index]];
      }
      if (originalRecord) {
        const recordIndex = this.records.indexOf(originalRecord);
        this.records.splice(recordIndex, 1);
      }
    });
    this.records.forEach((rec, idx) => {
      rec[index] = idx;
    });
    this.renderRecords();
    const totalPages = this.getTotalPages();
      if (this.currentPage > totalPages) {
        this.setPage(totalPages);
      }
      if(totalPages !== totalPagesBefore){
        dispatchEvent(this, 'pageCountChanged', { totalPages });
      }
    dispatchEvent(this, 'selectionChange');
  }

  getSelectedRecords() {
    const selectedRecords = this.records.filter(record => {
      const isSelected = record[selected];
      return isSelected;
    });
    return selectedRecords;
  }

  selectAllOnPage() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.records.length);
    for (let i = start; i < end; i++) {
      this.records[i][selected] = true;
    }
    this.renderRecords();
    setTimeout(() => {
      dispatchEvent(this, 'selectionChange');
    }, 0);
  }

  deselectAllOnPage() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.records.length);
    for (let i = start; i < end; i++) {
      this.records[i][selected] = false;
    }
    this.renderRecords();
    setTimeout(() => {
      dispatchEvent(this, 'selectionChange');
    }, 0);
  }

  allOnPageSelected() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, this.records.length);
    for (let i = start; i < end; i++) {
      if (!this.records[i][selected]) {
        return false;
      }
    }
    return true;
  }

  sortBy(field, asc = true) {
    this.sort = this.sort.filter(item => item.name !== field);
    this.sort.push({ name: field, asc });
    this.renderRecords();
  }

  hideRecord(record) {
    let originalRecord = this.records.find(r => r === record);
    if (!originalRecord && record[index] !== undefined) {
      originalRecord = this.records[record[index]];
    }
    if (originalRecord) {
      originalRecord[hidden] = true;
      this.renderRecords();
    }
  }

  showRecord(record) {
    let originalRecord = this.records.find(r => r === record);
    if (!originalRecord && record[index] !== undefined) {
      originalRecord = this.records[record[index]];
    }
    if (originalRecord) {
      originalRecord[hidden] = false;
      this.renderRecords();
    }
  }

  filterRecordsByField({ field, value, condition = 'eq' }) {
    this.records.forEach(record => {
      if (condition === 'eq') {
        record[hidden] = record[field] !== value;
      } else if (condition === 'not') {
        record[hidden] = record[field] === value;
      } else if (condition === 'gt') {
        record[hidden] = record[field] <= value;
      } else if (condition === 'lt') {
        record[hidden] = record[field] >= value;
      } else if (condition === 'gte') {
        record[hidden] = record[field] < value;
      } else if (condition === 'lte') {
        record[hidden] = record[field] > value;
      } else if (condition === 'contains') {
        record[hidden] = !String(record[field]).includes(String(value));
      } else if (condition === 'notContains') {
        record[hidden] = String(record[field]).includes(value);
      }
    });
    this.renderRecords();
  }

  getDisplayedRecords() {
    let displayedRecords = this.records.filter(record => !record[hidden]);

    this.sort.forEach(({ name, asc }) => {
      displayedRecords.sort((a, b) => {
        if (a[name] < b[name]) return asc ? -1 : 1;
        if (a[name] > b[name]) return asc ? 1 : -1;
        return 0;
      });
    });

    return displayedRecords;
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
      tr[editing] td {
        padding: 0;
      }
      tr[editing] input,
      tr[editing] select,
      tr[editing] .input {
        padding: calc(0.75 * var(--spacer)) var(--spacer) !important;
        width: 100%;
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
    },
    edit: {
      render: (table, record) => new Edit(table, record)
    }
  };

  static format(value){
    const f = Array.isArray(value) ? Table.formatters.array : Table.formatters[typeof value];
    return f(value);
  }

  static formatters = {
    string: v=>v,
    number: v=>`${v}`,
    date: v=>v.toLocaleDateString(),
    boolean: v=>v ? 'True' : 'False',
    array: v=>v.map(i=>Table.format(i)).join(', '),
    'undefined': v=>'',
    'null': v=>'<code>null</code>'
  };

  static editors = {
    string: (value) => {
      const $i = document.createElement('input');
      $i.value = value;
      return $i;
    },
    number: (value) => {
      const $i = document.createElement('input');
      $i.type = 'number';
      $i.value = value;
      return $i;
    },
    date: (value) => {
      const $i = document.createElement('input');
      $i.type = 'date';
      $i.value = value;
      return $i;
    },
    boolean: (value) => {
      const $i = document.createElement('select');
      $i.innerHTML = `
        <option value="true" ${value ? 'selected' : ''}>True</option>
        <option value="false" ${!value ? 'selected' : ''}>False</option>
      `;
      $i.value = value;
      return $i;
    },
  };
}
window.customElements.define('k-table', Table);
