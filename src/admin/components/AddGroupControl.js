import AdminTableControl from './AdminTableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class AddGroupControl extends AdminTableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Add to Group';
  }

  render(){ return html`<k-icon name="add"></k-icon>`; }
}

customElements.define('admin-add-group-control', AddGroupControl);
