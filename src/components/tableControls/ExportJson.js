import TableControl from './TableControl.js';
import '../Icon.js';
import { onEvent, offEvent } from '../../utils/element.js';

const clickHandler = Symbol('clickHandler');
export default class ExportJson extends TableControl {
  constructor() {
    super({
      maxWidth: 136
    });
  
    /* Private Methods */
    this[clickHandler] = this.export.bind(this);
  }

  /* Lifecycle Callbacks */
  async render(force = false){
    if(await super.render(force)){
      onEvent(this.shadowRoot.getElementById('export'), 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this.shadowRoot.getElementById('export'), 'click', this[clickHandler]);
  }

  /* Public Methods */
  export(){
    const record = this.record;
    if(record){
      const data = JSON.stringify(record);
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const data = JSON.stringify(this.table.records);
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  /* Shadow DOM */
  get shadowTemplate(){
    return /*html*/`
      <button id="export" class="no-btn ph">
        <slot><k-icon name="export-file"></k-icon> Export JSON</slot>
      </button>
    `;
  }
}
window.customElements.define('k-tc-export-json', ExportJson);