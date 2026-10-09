import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';
import { register } from '../sdk.js';
import safeNext from '../utils/safeNext.js';

/*
  The registration form. See Login.js for why this is a component and how content placed inside it
  is kept: the page holds `<location name="register-form-after" />` inside `<k-register>`.

  - `redirect`: where to go after registering (default `/account`). A same-site `?next=` wins.
  - `verify-redirect`: where to go instead when the site requires a verified email (default
    `/verify-email`).
*/
export default class Register extends LightComponent {
  static properties = {
    redirect: { type: String },
    verifyRedirect: { type: String, attribute: 'verify-redirect' },
  };

  constructor(){
    super();
    this.redirect = '/account';
    this.verifyRedirect = '/verify-email';
    this.extra = [];
  }

  /*
    Lifecycle
  */

  connectedCallback(){
    if(!this.extra.length) this.extra = [...this.childNodes];
    this.extra.forEach(node => node.remove());
    super.connectedCallback();
  }

  /*
    Events
  */

  submit = async event => {
    event.preventDefault();
    const form = new FormData(event.target);

    const [error, result] = await register({ name: form.get('name'), email: form.get('email'), password: form.get('password') });
    if(error){
      Toast.error(error.msg);
      return;
    }

    window.location.href = result.requiresVerification
      ? this.verifyRedirect
      : safeNext(new URLSearchParams(window.location.search).get('next')) || this.redirect;
  };

  /*
    Rendering
  */

  renderLightDom(){
    return html`
      <h2>Register</h2>
      <form @submit=${this.submit}>
        <div class="mb">
          <label for="k-register-name" class="d-b mb-sm">Name</label>
          <input type="text" id="k-register-name" name="name" required class="w-full p-sm br">
        </div>
        <div class="mb">
          <label for="k-register-email" class="d-b mb-sm">Email</label>
          <input type="email" id="k-register-email" name="email" required class="w-full p-sm br">
        </div>
        <div class="mb">
          <label for="k-register-password" class="d-b mb-sm">Password</label>
          <input type="password" id="k-register-password" name="password" required class="w-full p-sm br">
        </div>
        <button type="submit" class="w-full p-sm br">Register</button>
      </form>
      ${this.extra}
      <p class="mt">Already have an account? <a href="/login">Login</a></p>
    `;
  }
}

customElements.define('k-register', Register);
