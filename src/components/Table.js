import Component from './Component.js';
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
    filters = [],
    enablePages = false,
    pageSize = 50,
    pageSizeOptions = [10, 25, 50, 100, 500],
    currentPage = 1,
    enableSelection = false,
    enableSorting = false
  } = {}) {
    super();

    this.registerAttributes({
      enablePages,
      pageSize,
      currentPage,
      pageSizeOptions,
      enableSelection,
      enableSorting
    });

    this.registerProps({
      fields: fields,
      records: records,
      filters: filters,
      sort: [],
      columnSizes: {},
      fetchPending: false
    });
  }
  async render(force){
    if(await super.render(force)){
      this.setData({
        records: this.records,
        fields: this.fields,
        filters: this.filters
      });
      return true;
    }
    return false;
  }


  /*
    Render Functions
  */

  renderFields(){
    if(!this.rendered) return;
    this.calculateColumnSizes();
    this.hasTopControls()?this.setAttribute('top-controls', 'true'):this.removeAttribute('top-controls');
    this.hasBottomControls()?this.setAttribute('bottom-controls', 'true'):this.removeAttribute('bottom-controls');

    const $fields = this.shadowRoot.getElementById('fields');
    $fields.innerHTML = '';

    if(this.enableSelection){
      const $selectDiv = document.createElement('div');
      $selectDiv.classList.add('field', 'controls', 'cell', 'field-select');
      $selectDiv.style.width = '40px';
      $selectDiv.innerHTML = `<input type="checkbox" id="select-all" />`;
      $fields.appendChild($selectDiv);
    }
    if(this.hasBeforeControls()){
      const $beforeDiv = document.createElement('div');
      $beforeDiv.classList.add('field', 'cell', 'field-before-controls');
      $beforeDiv.style.width = this.columnSizes.beforeControls + 'px';
      $fields.appendChild($beforeDiv);
    }
    this.fields.forEach( ({name, label, hidden}) => {
      if (hidden) return; // Skip hidden fields
      const $fieldDiv = document.createElement('div');
      $fieldDiv.classList.add('field', 'cell');
      $fieldDiv.style.width = this.columnSizes[name] + 'px';
      $fieldDiv.innerHTML = label;
      if (this.enableSorting) {
        $fieldDiv.style.cursor = 'pointer';
        const currentSort = this.sort.find(s => s.name === name);
        if (currentSort) {
          $fieldDiv.classList.add(currentSort.asc ? 'sort-asc' : 'sort-desc');
          const $icon = document.createElement('k-icon');
          $icon.classList.add('icon-sort');
          $icon.setAttribute('name', currentSort.asc ? 'arrow-down' : 'arrow-up');
          $fieldDiv.appendChild($icon);
        }
        $fieldDiv.addEventListener('click', () => {
          const currentSort = this.sort.find(s => s.name === name);
          const asc = currentSort ? !currentSort.asc : true;
          this.sortBy(name, asc);
        });
      }
      $fields.appendChild($fieldDiv);
    });
    if(this.hasAfterControls()){
      const $afterDiv = document.createElement('div');
      $afterDiv.classList.add('field', 'cell', 'field-after-controls');
      $afterDiv.style.width = this.columnSizes.afterControls + 'px';
      $fields.appendChild($afterDiv);
    }

    $fields.style.width = 
      this.shadowRoot.getElementById('top').style.width = 
      this.shadowRoot.getElementById('bottom').style.width = 
      this.shadowRoot.getElementById('records').style.width = this.columnSizes.total + 'px';

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

    let displayedRecords = this.getDisplayedRecords(),
        start = 0,
        end = this.pageSize;

    if(this.enablePages){
      start = (this.currentPage - 1) * this.pageSize;
      end = start + this.pageSize;
      displayedRecords = displayedRecords.slice(start, end);
    }
    
    let fetchStart,
        fetchCount = 0;
    displayedRecords.forEach((record, index) => {
      if(record !== null){
        $records.appendChild(this.renderRecord(record));
      } else {
        if(!fetchStart) fetchStart = start + index;
        fetchCount++;
        const $div = document.createElement('div');
        $div.classList.add('record', 'fetching');
        $div.innerHTML = '<div class="cell">Loading...</div>';
        $records.appendChild($div);
      }
    });
    if(fetchStart && !this.fetchPending){
      dispatchEvent(this, 'fetchRecords', {
        start: fetchStart,
        count: fetchCount
      });
    }
  }

  renderRecord(record){
    const $record = document.createElement('div');
    $record.classList.add('record');
    $record.dataset.index = record[index];
    if (this.enableSelection) {
      const $selectionDiv = document.createElement('div');
      $selectionDiv.style.width = '40px';
      $selectionDiv.classList.add('cell', 'selection', 'controls');
      const $checkbox = document.createElement('input');
      $checkbox.type = 'checkbox';
      $checkbox.checked = record[selected];
      $checkbox.addEventListener('change', (event) => {
        record[selected] = !!event.target.checked;
        dispatchEvent(this, 'selectionChange');
      });
      $selectionDiv.appendChild($checkbox);
      $record.appendChild($selectionDiv);
    }
    if (this.hasBeforeControls()) {
      $record.appendChild(this.renderBeforeControls());
    }
    this.fields.forEach(({ name, formatter, calculator, type, editor, hidden }) => {
      if (hidden) return; // Skip hidden fields
      const $div = document.createElement('div');
      $div.classList.add('cell');
      $div.dataset.field = name;
      $div.style.width = this.columnSizes[name] + 'px';
      let value = record[name] || '';
      if(record[editing]){
        $record.setAttribute('editing', true);
        if (calculator) {
          $div.appendChild(Table.editors.calculated(calculator(record, this)));
        } else if(editor){
          $div.appendChild(editor(value));
        } else {
          let editorGen = Table.editors[type || typeof value];
          if(!editorGen){
            editorGen = Table.editors.string;
          }
          $div.appendChild(editorGen(value));
        }
      } else {
        if (calculator) {
          $div.innerHTML = calculator(record, this);
        } else if (formatter) {
          $div.innerHTML = formatter(value);
        } else {
          $div.innerHTML = value;
        }
      }
      $record.appendChild($div);
    });
    if (this.hasAfterControls()) {
      $record.appendChild(this.renderAfterControls());
    }
    return $record;
  }

  renderBeforeControls(){
    const $div = document.createElement('div');
    $div.style.width = this.columnSizes.beforeControls + 'px';
    $div.classList.add('cell', 'controls', 'controls-before');
    this.querySelectorAll('[slot="before"]').forEach($control => {
      $div.appendChild($control.cloneNode(true));
    });
    return $div;
  }

  renderAfterControls(){
    const $div = document.createElement('div');
    $div.style.width = this.columnSizes.afterControls + 'px';
    $div.classList.add('cell', 'controls', 'controls-after');
    this.querySelectorAll('[slot="after"]').forEach($control => {
      $div.appendChild($control.cloneNode(true));
    });
    return $div;
  }





  hasBeforeControls(){
    return !!this.querySelector('[slot="before"]');
  }

  hasAfterControls(){
    return !!this.querySelector('[slot="after"]');
  }

  hasTopControls(){
    return !!this.querySelector('[slot="top"]');
  }

  hasBottomControls(){
    return !!this.querySelector(':scope > :not([slot])'); // bottom is default slot, detect direct child with no slot
  }

  editRecord(record){
    record[editing] = true;
    const $currentRecord = this.shadowRoot.querySelector(`.record[data-index="${record[index]}"]`);
    const $newRecord = this.renderRecord(record);
    $currentRecord.replaceWith($newRecord);
    dispatchEvent(this, 'editingChange');
  }
  
  saveEditedRecord(record){
    record[editing] = false;
    const $currentRecord = this.shadowRoot.querySelector(`.record[data-index="${record[index]}"]`);
    $currentRecord.querySelectorAll('.cell').forEach(($cell) => {
      const field = $cell.dataset.field;
      const fieldDef = this.fields.find(f => f.name === field);
      if(fieldDef && !fieldDef.calculator){ // calculated fields cannot be udated
        const $input = $cell.children.length === 1 ? $cell.firstChild : $cell.querySelector('input, select');
        if ($input) {
          record[field] = $input.value;
        }
      }
    });
    $currentRecord.replaceWith(this.renderRecord(record));
  }

  cancelEditedRecord(record){
    record[editing] = false;
    this.shadowRoot.querySelector(`.record[data-index="${record[index]}"]`).replaceWith(this.renderRecord(record));
  }

  recordIsEditing(record){
    return record[editing];
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

  firstPage(){
    if(this.currentPage !== 1){
      this.setPage(1);
    }
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

  lastPage() {
    if (this.currentPage !== this.getTotalPages()) {
      this.setPage(this.getTotalPages());
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
    pageSize = false,
    pageSizeOptions = false,
    currentPage = false,
    enableSelection
  } = {}) {
    let rerender = false,
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
    const newPageCount = this.getTotalPages();
    if(newPageCount !== pageCountBefore){
      dispatchEvent(this, 'pageCountChanged', { totalPages: this.getTotalPages() });
    }
    if(pageBefore > newPageCount){
      this.setPage(newPageCount); 
    }
  }

  setRecords(records, fields) {
    let pageCountBefore = this.getTotalPages(),
        pageBefore = this.currentPage;

    this.records = records.map(r=>({...r}));
    this.records.forEach((record, idx) => {
      record[index] = idx;
      record[selected] = false;
      record[hidden] = false;
      record[editing] = false;
    });
    this.fields = fields || Table.extractFieldsFromRecords(this.records);
    this.renderFields();
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
      if(this.fetchPending) return;
      this.fetchPending = true;
      const { start, count } = event.detail;
      const records = await callback(start, count);
      this.records.splice(start, records.length, ...records);
      this.fetchPending = false;
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
    this.renderFields(); // Re-render fields to update sort classes and icons
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
      dispatchEvent(this, 'recordHidden');
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
      dispatchEvent(this, 'recordShown');
    }
  }

  showAllRecords() {
    this.records.forEach(record => {
      record[hidden] = false; 
    });
    if(this.filters.length){
      this.filters = [];
      dispatchEvent(this, 'filterRemoved filterChange');
    }
    this.renderRecords();
    dispatchEvent(this, 'recordShown allRecordsShown');
  }

  addFilter(field, condition, value) {
    this.filters.push({ field, condition, value });
    dispatchEvent(this, 'filterAdded filterChange');
    this.renderRecords();
  }
  
  removeFilter(field, condition, value, rerender = true) {
    const filterIndex = this.filters.findIndex(f => f.field === field && f.condition === condition && f.value === value);
    if (filterIndex !== -1) {
      this.records.forEach(record => {
        if(!this.testFilter(record, field, condition, value)){
          record[hidden] = false;
        }
      });
      this.filters.splice(filterIndex, 1);
      dispatchEvent(this, 'filterRemoved filterChange');
      if(rerender) this.renderRecords();
    }
  }

  testFilter(record, field, condition, value) {
    const recordValue = record[field];
    switch (condition) {
      case 'equals':
        return recordValue === value;
      case 'not-equals':
        return recordValue !== value;
      case 'contains':
        return recordValue.includes(value);
      case 'not-contains':
        return !recordValue.includes(value);
      case 'greater-than':
        return recordValue > value;
      case 'less-than':
        return recordValue < value;
      case 'greater-than-or-equal':
        return recordValue >= value;
      case 'less-than-or-equal':
        return recordValue <= value;
      default:
        return true;
    }
  }

  removeAllFilters() {
    if(this.filters.length){
      this.filters.forEach(({ field, condition, value }) => {
        this.removeFilter(field, condition, value, false);
      });
      this.renderRecords();
    }
  }

  search(term) {
    const t = term.trim().toLowerCase();
    let changed = false;
    this.records.forEach(record => {
      if (record[hidden]) return;
      let match = false;
      this.fields.forEach(({ name }) => {
        const val = record[name]?.toString().toLowerCase() || '';
        if (val.includes(t)) {
          match = true;
        }
      });
      if (record[hidden] !== !match) {
        record[hidden] = !match;
        changed = true;
      }
    });
    if (changed) {
      dispatchEvent(this, 'recordHidden');
      this.renderRecords();
    }
    dispatchEvent(this, 'search', { term });
  }

  getDisplayedRecords() {
    this.filters.forEach(({ field, condition, value }) => {
      this.records.forEach(record => {  
        if (!this.testFilter(record, field, condition, value)) {
          record[hidden] = true;
        }
      });
    });

    let displayedRecords = this.records.filter(record => record === null || !record[hidden]);

    this.sort.forEach(({ name, asc }) => {
      displayedRecords.sort((a, b) => {
        if (a[name] < b[name]) return asc ? -1 : 1;
        if (a[name] > b[name]) return asc ? 1 : -1;
        return 0;
      });
    });

    return displayedRecords;
  }

  getHiddenRecords() {
    return this.records.filter(record => record[hidden]);
  }

  calculateColumnSizes() {
    this.columnSizes = {};
    this.columnSizes.total = 0;
    if(this.enableSelection) this.columnSizes.total += 40;
    this.columnSizes.beforeControls = Array.from(this.querySelectorAll('[slot="before"]')).reduce((total, el) => total + (el.maxWidth || 40), 0);
    this.columnSizes.afterControls = Array.from(this.querySelectorAll('[slot="after"]')).reduce((total, el) => total + (el.maxWidth || 40), 0);
    if(this.hasBeforeControls()) this.columnSizes.total += this.columnSizes.beforeControls;
    if(this.hasAfterControls()) this.columnSizes.total += this.columnSizes.afterControls;
    
    this.fields.forEach(field => {
      if (field.size) {
      this.columnSizes[field.name] = field.size;
      } else {
      let maxLength = 0;
      this.records.slice(0, 100).forEach(record => {
        let value = record[field.name];
        if (field.calculator) {
          value = field.calculator(record, this);
        }
        if (field.formatter) {
          value = field.formatter(value);
        }
        if (value && value.toString().length > maxLength) {
        maxLength = value.toString().length;
        }
      });
      this.columnSizes[field.name] = Math.max((maxLength * 10 + 32), 128);
      if(!field.hidden) this.columnSizes.total += this.columnSizes[field.name];
      }
    });
    return this.columnSizes;
  }

  setFieldHiddenState(fieldName, hidden) {
    const field = this.fields.find(f => f.name === fieldName);
    if (field) {
      field.hidden = hidden;
      this.calculateColumnSizes();
      this.renderFields();
      this.renderRecords();
      dispatchEvent(this, 'fieldVisibilityChanged ' + (hidden ? 'fieldHidden' : 'fieldShown'), { field });
    }
  }

  hideField(fieldName) {
    this.setFieldHiddenState(fieldName, true);
  }

  showField(fieldName) {
    this.setFieldHiddenState(fieldName, false);
  }

  reorderFields(newOrder) {
    const newFields = [];
    newOrder.forEach(fieldName => {
      const field = this.fields.find(f => f.name === fieldName);
      if (field) {
        newFields.push(field);
      }
    });
    this.fields = newFields;
    this.renderFields();
    this.renderRecords();
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <div id="wrapper">
        <div id="top"><slot name="top"></slot></div>
        <div id="table">
          <div id="fields"></div>
          <div id="records"></div>
        </div>
        <div id="bottom">${super.shadowTemplate}</div>
      </div>
      <div style="display: none">
        <slot name="before"></slot>
        <slot name="after"></slot>
      </div>
    `;
  }

  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        width: 100%;
        overflow: auto;
        margin-bottom: var(--spacer);
      }
      #wrapper {
        width: min-content;
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
      }
      #table {
        width: min-content;
      }
      #fields,
      .record {
        display: flex;
      }
      #fields {
        background-color: var(--c_bg__alt);
        border-bottom: 1px solid var(--c_border);
      }
      .record:not([editing="true"]) .cell:not(.controls),
      #fields .cell:not(.controls) {
        padding: calc(0.5 * var(--spacer)) var(--spacer);
      }
      .cell:not(:first-child) {
        border-left: 1px solid var(--c_border);
      }
      .record:not(:last-child) .cell {
        border-bottom: 1px solid var(--c_border);
      }
      #top, #bottom {
        display: flex;
        width: 100%;
      }
      #top slot {
        display: block;
        width: 100%;
        border-bottom: 1px solid var(--c_border);
      }
      #bottom slot {
        display: block;
        width: 100%;
        border-top: 1px solid var(--c_border);
      }
      :host(:not([top-controls])) #top,
      :host(:not([bottom-controls])) #bottom {
        display: none;
      }
      .field-select,
      .selection {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .field-select input,
      .selection input {
        width: 1.25rem;
        height: 1.25rem;
      }
      .icon-sort {
        float: right;
        opacity: 0.5;
      }
    `;
  }


  /* Static Methods */
  static extractFieldsFromRecords(records, recordLimit = 100){
    const names = new Set();
    records.slice(0, recordLimit).forEach( record => {
      Object.keys(record).forEach( name => names.add(name) )
    });
    return [...names].map(name=>({name,label:toTitleCase(name)}));
  };

  /* Static Members */
  static format(value){
    const f = Array.isArray(value) ? Table.formatters.array : Table.formatters[typeof value];
    return f(value);
  };

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
    calculated: (value) => {
      const $i = document.createElement('input');
      $i.disabled = true;
      $i.value = value;
      return $i;
    }
  };
}
window.customElements.define('k-table', Table);
