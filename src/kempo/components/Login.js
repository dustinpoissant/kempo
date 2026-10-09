import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';
import { login } from '../sdk.js';
import safeNext from '../utils/safeNext.js';

/*
  The login form.

  Lives in kempo, not in each site's copy of the login page, so an update to kempo reaches every
  site. A site's page is just this element, and anything it needs to differ is an attribute:

  - `redirect`: where to go after signing in (default `/account`). A same-site `?next=` in the
    page's URL wins over it.

  **Content placed inside the element is kept** and shown between the form and the links. That is
  how an extension adds another way in: the page holds `<location name="login-form-after" />`
  inside `<k-login>`, the server fills it before the browser sees the page, and it ends up here.
*/
export default class Login extends LightComponent {
  static properties = {
    redirect: { type: String },
  };

  constructor(){
    super();
    this.redirect = '/account';
    this.extra = [];
  }

  /*
    Lifecycle
  */

  connectedCallback(){
    // Taken before the first render, which would otherwise leave them sitting after it.
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

    const [error] = await login({ email: form.get('email'), password: form.get('password') });
    if(error){
      Toast.error(error.msg);
      return;
    }

    window.location.href = safeNext(new URLSearchParams(window.location.search).get('next')) || this.redirect;
  };

  /*
    Rendering
  */

  renderLightDom(){
    return html`
      <h2>Login</h2>
      <form @submit=${this.submit}>
        <div class="mb">
          <label for="k-login-email" class="d-b mb-sm">Email</label>
          <input type="email" id="k-login-email" name="email" required class="w-full p-sm br">
        </div>
        <div class="mb">
          <label for="k-login-password" class="d-b mb-sm">Password</label>
          <input type="password" id="k-login-password" name="password" required class="w-full p-sm br">
        </div>
        <button type="submit" class="w-full p-sm br">Login</button>
      </form>
      ${this.extra}
      <p class="mt"><a href="/forgot-password">Forgot Password?</a></p>
      <p class="mt">Don't have an account? <a href="/register">Register</a></p>
    `;
  }
}

customElements.define('k-login', Login);
