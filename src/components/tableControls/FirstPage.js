import TableControl from './TableControl.js';
import { onEvent, offEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler'),
      handlePageChange = Symbol('handlePageChange');
export default class FirstPage extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[clickHandler] = this.goToFirstPage.bind(this);
    this[handlePageChange] = (()=>{
      const table = this.table;
      if(!table || table.getCurrentPage() === 1){
        this.shadowRoot.getElementById('firstPage').disabled = true;
      } else {
        this.shadowRoot.getElementById('firstPage').disabled = false;
      }
    }).bind(this);
  }

  /* Lifecycle Callback */
  async render(force = false) {
    if(await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('firstPage'), 'click', this[clickHandler]);
      this[handlePageChange]();
      onEvent(this.table, 'pageChange', this[handlePageChange]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('firstPage'), 'click', this[clickHandler]);
    offEvent(this.table, 'pageChange', this[handlePageChange]);
  }

  /* Public Methods */
  goToFirstPage(){
    const table = this.table;
    if(table){
      table.firstPage();
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button
        id="firstPage"
        class="no-btn icon-btn"
      >
        <slot><k-icon name="first"></k-icon></slot>
      </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      #firstPage[disabled] {
        cursor: inherit;
        opacity: 0.5;
      }
    `;
  }


}
window.customElements.define('k-tc-first-page', FirstPage);