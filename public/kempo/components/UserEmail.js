import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserEmail extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadUserEmail();
  }

  async loadUserEmail() {
    try {
      const session = await getSession();
      this.textContent = session?.user?.email || '';
    } catch(error) {
      console.error('Failed to load user email:', error);
      this.textContent = '';
    }
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-email', UserEmail);
