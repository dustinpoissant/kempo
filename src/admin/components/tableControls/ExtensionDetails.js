import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Opens the marketplace page for a row's extension: its README, what it requires and adds, its rating (which
  can be changed from there once it is installed). The page shows whatever the marketplace knows; for an
  extension it does not list it says so.
*/
export default class ExtensionDetails extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'View in Store';
  }

  handleAction(){
    if(!this.record) return;
    window.location.href = `/admin/extensions/details/?name=${encodeURIComponent(this.record.name)}`;
  }

  render(){ return html`<k-icon name="storefront"></k-icon>`; }
}

customElements.define('admin-extension-details', ExtensionDetails);
