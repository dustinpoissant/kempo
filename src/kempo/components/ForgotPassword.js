import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';
import { forgotPassword } from '../sdk.js';

/*
  The forgot password form: asks for an email address and sends the link that resets the password. After it is sent it
  says to check the email, and offers to send it again.

  Lives in kempo so an update reaches every site; the page is just this element, and a widget in the page builder.
  `login-href` is where "Login" goes (default `/login`).
*/
export default class ForgotPassword extends LightComponent {
  static properties = {
    loginHref: { type: String, attribute: 'login-href' },
    sent: { state: true },
    busy: { state: true },
  };

  constructor(){
    super();
    this.loginHref = '/login';
    this.sent = false;
    this.busy = false;
  }

  /*
    Events
  */

  submit = async event => {
    event.preventDefault();
    this.busy = true;
    const [error] = await forgotPassword({ email: new FormData(event.target).get('email') });
    this.busy = false;
    if(error){
      Toast.error(error.msg);
      return;
    }
    this.sent = true;
  };

  again = event => {
    event.preventDefault();
    this.sent = false;
  };

  /*
    Rendering
  */

  renderLightDom(){
    if(this.sent){
      return html`
        <h2>Check Your Email</h2>
        <p>We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.</p>
        <p class="mt">The link will expire in 1 hour.</p>
        <p class="mt">Didn't receive the email? Check your spam folder or <a href="#" @click=${this.again}>try again</a>.</p>
        <p class="mt"><a href=${this.loginHref}>Back to Login</a></p>
      `;
    }
    return html`
      <h2>Forgot Password</h2>
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      <form @submit=${this.submit}>
        <label for="k-forgot-email">Email</label>
        <input type="email" id="k-forgot-email" name="email" required />
        <button type="submit" class="p-sm br mt" ?disabled=${this.busy}>${this.busy ? 'Sending...' : 'Send Reset Link'}</button>
      </form>
      <p class="mt">Remember your password? <a href=${this.loginHref}>Login</a></p>
    `;
  }
}

customElements.define('k-forgot-password', ForgotPassword);
