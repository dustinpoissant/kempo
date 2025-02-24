import TableControl from './TableControl.js';
import { onEvent, offEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler'),
      handlePageChange = Symbol('handlePageChange');
export default class LastPage extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[clickHandler] = this.lastPage.bind(this);
    this[handlePageChange] = (()=>{
      const table = this.table;
      if(!table || table.getCurrentPage() === table.getTotalPages()){
        this.shadowRoot.getElementById('lastPage').disabled = true;
      } else {
        this.shadowRoot.getElementById('lastPage').disabled = false;
      }
    }).bind(this);
  }

  /* Lifecycle Callback */
  async render(force = false) {
    if(await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('lastPage'), 'click', this[clickHandler]);
      this[handlePageChange]();
      onEvent(this.table, 'pageChange', this[handlePageChange]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('lastPage'), 'click', this[clickHandler]);
    offEvent(this.table, 'pageChange', this[handlePageChange]);
  }

  /* Public Methods */
  lastPage(){
    const table = this.table;
    if(table){
      table.lastPage();
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button
        id="lastPage"
        class="no-btn icon-btn"
      >
        <slot><k-icon name="last"></k-icon></slot>
      </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      #lastPage[disabled] {
        cursor: inherit;
        opacity: 0.5;
      }
    `;
  }
}
window.customElements.define('k-tc-last-page', LastPage);