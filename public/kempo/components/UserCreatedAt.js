import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserCreatedAt extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadCreatedAt();
  }

  async loadCreatedAt() {
    try {
      const session = await getSession();
      const date = new Date(session?.user?.createdAt);
      this.textContent = date.toLocaleDateString();
    } catch(error) {
      console.error('Failed to load user created date:', error);
      this.textContent = '';
    }
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-created-at', UserCreatedAt);
