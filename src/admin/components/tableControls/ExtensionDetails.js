import AdminTableControl from '../AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Opens the full details page for a row's extension (README, what it requires and adds, rating,
  install). The page shows whatever the marketplace knows; for an extension it does not list it says so.
*/
export default class ExtensionDetails extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Extension Details';
  }

  handleAction(){
    if(!this.record) return;
    window.location.href = `/admin/extensions/details/?name=${encodeURIComponent(this.record.name)}`;
  }

  render(){ return html`<k-icon name="info"></k-icon>`; }
}

customElements.define('admin-extension-details', ExtensionDetails);
