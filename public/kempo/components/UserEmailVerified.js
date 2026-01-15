import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserEmailVerified extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadEmailVerified();
  }

  async loadEmailVerified() {
    try {
      const session = await getSession();
      this.textContent = session?.user?.emailVerified ? 'Yes' : 'No';
    } catch(error) {
      console.error('Failed to load email verified status:', error);
      this.textContent = '';
    }
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-email-verified', UserEmailVerified);
