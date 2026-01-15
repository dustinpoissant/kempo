import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserName extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadUserName();
  }

  async loadUserName() {
    try {
      const session = await getSession();
      this.textContent = session?.user?.name || '';
    } catch(error) {
      console.error('Failed to load user name:', error);
      this.textContent = '';
    }
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-name', UserName);
