import LightComponent from '/kempo-ui/components/LightComponent.js';
import { logout } from '../sdk.js';

export default class LogoutBtn extends LightComponent {
  static get properties() {
    return {
      redirect: { type: String },
      buttonClass: { type: String, attribute: 'button-class' }
    };
  }

  connectedCallback() {
    this.buttonText = this.textContent.trim() || 'Logout';
    this.innerHTML = '';
    super.connectedCallback();
  }

  updated(changedProperties) {
    super.updated(changedProperties);
  }

  handleLogout = async () => {
    try {
      await logout();
      if(this.redirect){
        window.location.href = this.redirect;
      }
    } catch(error) {
      console.error('Logout failed:', error);
    }
  };

  renderLightDom() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = this.buttonClass ? `kempo-component-logout ${this.buttonClass}` : 'kempo-component-logout';
    button.textContent = this.buttonText;
    button.addEventListener('click', this.handleLogout);
    return button;
  }
}

customElements.define('k-logout-btn', LogoutBtn);
