import Component from '../Component.js';
import Dialog from '../Dialog.js';
import { offEvent, onEvent } from '../../utils/element.js';

const table = Symbol('table'),
      clickHandler = Symbol('clickHandler');
export default class Filters extends Component {
  constructor(_table) {
    super();

    /* Private Members */
    this[table] = _table;

    /* Private Methods */
    this[clickHandler] = this.revealFilters.bind(this);

    /* Init */
    this.classList.add('mxq');
  }

  /* Lifecycle Callbacks */
  async render(force = false) {
    if (await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('filterBtn'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('filterBtn'), 'click', this[clickHandler]);
  }

  /* Public Methods */
  revealFilters() {
    function formatFilter({field, condition, value}) {
      const conditionLabel = {
        eq: 'equals',
        ne: 'does not equal',
        gt: 'is greater than',
        gte: 'is greater than or equal to',
        lt: 'is less than',
        lte: 'is less than or equal to',
        contains: 'contains',
        starts: 'starts with',
        ends: 'ends with'
      }[condition];
      return /*html*/`<li
        data-field="${field}"
        data-condition="${condition}"
        data-value="${value}"
      >
        ${field} ${conditionLabel} ${value}
        <button class="remove-filter no-btn pq">
          <k-icon name="close"></k-icon>
        </button>
    </li>`;
    }
    const $dialog = Dialog.create( /*html*/`
      <h3 slot="title" class="m0 pyh px">Filters</h3>
      <div class="p">
        ${this[table].filters.length === 0 ? /*html*/`
          <p>No Current Filters.</p>
        ` :  /*html*/`
          <h5>Current Filters</h5>
          <ul id="currentFilters">${
            this[table].filters.map(formatFilter).join('') 
          }</ul>
        `}
        <hr />
        <h5>Add A Filter</h5>
        <form id="addFilter">
          <select id="filterField" class="mb">${
            this[table].fields.map(({name, label}) => /*html*/`<option value="${name}">${label}</option>`).join('') 
          }</select>
          <select id="filterCondition" class="mb">${
            Object.entries({
              eq: 'equals',
              ne: 'does not equal',
              gt: 'is greater than',
              gte: 'is greater than or equal to',
              lt: 'is less than',
              lte: 'is less than or equal to',
              contains: 'contains',
              starts: 'starts with',
              ends: 'ends with'
            }).map(([key, value]) => /*html*/`<option value="${key}" ${key==='contains'?'selected':''}>${value}</option>`).join('') 
          }</select>
          <input id="filterValue" type="text" class="mb" />
          <button type="submit" class="btn primary">Add Filter</button>
        </form>
      </div>
    `, {
      width: '600px'
    });
    const $form = $dialog.querySelector('#addFilter');
    onEvent($form, 'submit', (e) => {
      e.preventDefault();
      this[table].addFilter(
        $form.filterField.value,
        $form.filterCondition.value,
        $form.filterValue.value
      );
      $dialog.close();
      this.revealFilters();
    });
    onEvent($dialog, 'click', (e) => {
      if(e.target.closest('button')?.classList.contains('remove-filter')){
        const $li = e.target.closest('li');
        if($li){
          const {field, condition, value} = $li.dataset;
          this[table].removeFilter(field, condition, value);
          $dialog.close();
          this.revealFilters();
        }
      }
    });
  }

  get shadowTemplate() {
    return /*html*/`
      <button id="filterBtn" class="no-btn pq">
        <k-icon name="filter"></k-icon>
      </button>
    `;
  }
}
window.customElements.define('k-table-filters', Filters);