import TableControl from './TableControl.js';
import { onEvent, offEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler'),
      handlePageChange = Symbol('handlePageChange');
export default class NextPage extends TableControl {
  constructor() {
    super();

    /* Private Methods */
    this[clickHandler] = this.nextPage.bind(this);
    this[handlePageChange] = (()=>{
      const table = this.table;
      if(!table || table.getCurrentPage() === table.getTotalPages()){
        this.shadowRoot.getElementById('nextPage').disabled = true;
      } else {
        this.shadowRoot.getElementById('nextPage').disabled = false;
      }
    }).bind(this);
  }

  /* Lifecycle Callback */
  async render(force = false) {
    if(await super.render(force)) {
      onEvent(this.shadowRoot.getElementById('nextPage'), 'click', this[clickHandler]);
      this[handlePageChange]();
      onEvent(this.table, 'pageChange', this[handlePageChange]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('nextPage'), 'click', this[clickHandler]);
    offEvent(this.table, 'pageChange', this[handlePageChange]);
  }

  /* Public Methods */
  nextPage(){
    const table = this.table;
    if(table){
      table.nextPage();
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button
        id="nextPage"
        class="no-btn icon-btn"
      >
        <slot><k-icon name="chevron-right"></k-icon></slot>
      </button>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      #nextPage[disabled] {
        cursor: inherit;
        opacity: 0.5;
      }
    `;
  }


}
window.customElements.define('k-tc-next-page', NextPage);