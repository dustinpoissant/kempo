import TableControl from './TableControl.js';
import { onEvent, offEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler'),
      handlePageChange = Symbol('handlePageChange');
export default class PrevPage extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[clickHandler] = this.prevPage.bind(this);
    this[handlePageChange] = (()=>{
      const table = this.table;
      if(!table || table.getCurrentPage() === 1){
        this.shadowRoot.getElementById('prevPage').disabled = true;
      } else {
        this.shadowRoot.getElementById('prevPage').disabled = false;
      }
    }).bind(this);
  }

  /* Lifecycle Callback */
  async render(force = false) {
    if(await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('prevPage'), 'click', this[clickHandler]);
      this[handlePageChange]();
      onEvent(this.table, 'pageChange', this[handlePageChange]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('prevPage'), 'click', this[clickHandler]);
    offEvent(this.table, 'pageChange', this[handlePageChange]);
  }

  /* Public Methods */
  prevPage(){
    const table = this.table;
    if(table){
      table.prevPage();
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button
        id="prevPage"
        class="no-btn icon-btn"
      >
        <slot><k-icon name="chevron-left"></k-icon></slot>
      </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      #prevPage[disabled] {
        cursor: inherit;
        opacity: 0.5;
      }
    `;
  }


}
window.customElements.define('k-tc-prev-page', PrevPage);