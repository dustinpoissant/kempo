import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserEmailVerified extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadEmailVerified();
  }

  async loadEmailVerified() {
    const [error, session] = await getSession();
    if(error){
      console.error('Failed to load email verified status:', error.msg);
      this.textContent = '';
      return;
    }
    this.textContent = session?.user?.emailVerified ? 'Yes' : 'No';
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-email-verified', UserEmailVerified);
