import TableControl from './TableControl.js';
import { onEvent, offEvent } from '../../utils/element.js';
import Dialog from '../Dialog.js';

const clickHandler = Symbol('clickHandler');
export default class FieldSortHide extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[clickHandler] = this.openDialog.bind(this);
  }
  async render(force = false) {
    if (await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('sort'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('sort'), 'click', this[clickHandler]);
  }

  openDialog() {
    import('../Sortable.js')
    const $dialog = Dialog.create(/*html*/`
      <h3 class="m0 ph" slot="title">Show / Hide Fields</h3>
      <div class="m">
        <k-sortable id="sorting">
          ${this.table.fields.map(field => /*html*/`
            <k-sortable-item data-field="${field.name}">
              <label class="field pb0">
                <input
                  class="field-visibility"
                  data-field="${field.name}"
                  type="checkbox"
                  ${field.hidden ? '' : 'checked'}
                  style="height: 1.25rem; width: 1.25rem"
                />
                ${field.label}
              </label>
            </k-sortable-item>
          `).join('')}
        </k-sortable>
      </div>
    `, {
      width: '400px',
      cancelText: 'Close'
    });
    onEvent($dialog, 'click', (event) => {
      if (!event.target.closest('.field')) return;
      const $input = event.target.closest('.field-visibility');
      if ($input) {
        const fieldName = $input.getAttribute('data-field');
        this.table.setFieldHiddenState(fieldName, !$input.checked);
      }
    });
    const $sorting = $dialog.querySelector('#sorting');
    onEvent($sorting, 'sort', () => {
      const newOrder = Array.from($sorting.querySelectorAll('k-sortable-item')).map(item => item.getAttribute('data-field'));
      this.table.reorderFields(newOrder);
    });
  }

  get shadowTemplate() {
    return /*html*/`
      <button
        id="sort"
        class="no-btn icon-btn"
      >
        <k-icon name="table-visibility"></k-icon>
      </button>
    `;
  }
}
window.customElements.define('k-tc-field-sort-hide', FieldSortHide);