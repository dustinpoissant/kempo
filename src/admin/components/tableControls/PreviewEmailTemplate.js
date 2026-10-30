import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Previews one email template in a dialog. The table is told which record, as a `previewTemplate` event: { record }.
*/
export default class PreviewEmailTemplate extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Preview';
  }

  handleAction(){
    if(!this.record) return;
    this.table.dispatchEvent(new CustomEvent('previewTemplate', { detail: { record: this.record } }));
  }

  render(){ return html`<slot><k-icon name="visibility"></k-icon></slot>`; }
}

customElements.define('admin-preview-email-template', PreviewEmailTemplate);
