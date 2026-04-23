import LightComponent from '/kempo-ui/components/LightComponent.js';
import { getSession } from '../sdk.js';

export default class UserCreatedAt extends LightComponent {
  connectedCallback() {
    super.connectedCallback();
    this.loadCreatedAt();
  }

  async loadCreatedAt() {
    const [error, session] = await getSession();
    if(error){
      console.error('Failed to load user created date:', error.msg);
      this.textContent = '';
      return;
    }
    const date = new Date(session?.user?.createdAt);
    this.textContent = date.toLocaleDateString();
  }

  renderLightDom() {
    return 'Loading...';
  }
}

customElements.define('k-user-created-at', UserCreatedAt);
