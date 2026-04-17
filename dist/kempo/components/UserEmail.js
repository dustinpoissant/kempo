import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserEmail extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadUserEmail();
  }

  async loadUserEmail() {
    const [error, session] = await getSession();
    if(error){
      console.error('Failed to load user email:', error.msg);
      this.textContent = '';
      return;
    }
    this.textContent = session?.user?.email || '';
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-email', UserEmail);
