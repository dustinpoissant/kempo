import LightComponent from '/kempo-ui/components/LightComponent.js';

export default class UserDisplayName extends LightComponent {
  static properties = {
    userId: { type: String, attribute: 'user-id', reflect: true },
  };

  constructor(){
    super();
    this.userId = '';
  }

  updated(changed){
    super.updated?.(changed);
    if(changed.has('userId') && this.userId) this.load();
  }

  async load(){
    try {
      const res = await fetch(`/kempo/api/user/${this.userId}/name`);
      if(!res.ok) return;
      const { name } = await res.json();
      this.textContent = name || this.userId;
    } catch {
      this.textContent = this.userId;
    }
  }

  renderLightDom(){
    return this.userId;
  }
}

customElements.define('k-user-display-name', UserDisplayName);
