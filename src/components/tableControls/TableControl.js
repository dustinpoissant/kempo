import Component from '../Component.js';

export default class TableControl extends Component {
  constructor({
    maxWidth = 40
  } = {}){
    super();

    this.registerAttributes({
      maxWidth
    });
  }

  /* Protected Members */
  get table(){
    if (this.getRootNode() instanceof ShadowRoot) {
      return this.getRootNode().host.closest('k-table');
    } else {
      return this.closest('k-table');
    }
  }
  get record(){
    if (this.getRootNode() instanceof ShadowRoot) {
      const $record = this.closest('.record');
      if($record){
        const index = $record.dataset.index;
        if(index){
          return this.table.records[index];
        }
      }
    }
    return false;
  }

  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: inline-flex;
      }
      .icon-btn {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
      }
    `;
  }
}
// we do not need to register this component as a custom element because it is only used as a base class for other components