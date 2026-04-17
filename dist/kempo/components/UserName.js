import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserName extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadUserName();
  }

  async loadUserName() {
    const [error, session] = await getSession();
    if(error){
      console.error('Failed to load user name:', error.msg);
      this.textContent = '';
      return;
    }
    this.textContent = session?.user?.name || '';
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-name', UserName);
