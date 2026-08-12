import AdminTableControl from './AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class TableRowLink extends AdminTableControl {
  static properties = {
    urlPattern: { type: String, attribute: 'url-pattern' },
    fieldName: { type: String, attribute: 'field-name' }
  };

  constructor(){
    super();
    this.fieldName = 'id';
  }

  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'View';
  }

  handleAction(){
    if(!this.record) return;
    const fieldValue = this.record[this.fieldName];
    if(!fieldValue) return;
    window.location.href = this.urlPattern.replace(`{${this.fieldName}}`, fieldValue);
  }

  render(){ return html`<slot><k-icon name="visibility"></k-icon></slot>`; }
}

customElements.define('admin-table-row-link', TableRowLink);
