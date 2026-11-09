import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { verifyEmail } from '../sdk.js';

/*
  Verifies an email address from the link that was emailed (/verify-email/<token>), and says how it went: checking, done
  (and on to the account after two seconds), or what went wrong, with a way to the login page.

  Lives in kempo so an update reaches every site. `token` is the one in the link; without it the last part of the page's
  address is used, which is where the link puts it. `redirect` is where to go once verified (default `/account`) and
  `login-href` is where "Go to Login" goes (default `/login`).
*/
export default class VerifyEmail extends LightComponent {
  static properties = {
    token: { type: String },
    redirect: { type: String },
    loginHref: { type: String, attribute: 'login-href' },
    phase: { state: true },
    message: { state: true },
  };

  constructor(){
    super();
    this.token = '';
    this.redirect = '/account';
    this.loginHref = '/login';
    this.phase = 'loading';
    this.message = '';
  }

  /*
    Lifecycle
  */

  connectedCallback(){
    super.connectedCallback();
    this.verify();
  }

  /* Checks the address with the server, and goes to the account when it is verified. */
  verify = async () => {
    const parts = window.location.pathname.split('/');
    const token = this.token || parts[parts.length - 1] || parts[parts.length - 2];
    if(!token || token === 'verify-email'){
      this.message = 'No verification token found in URL.';
      this.phase = 'error';
      return;
    }
    const [error] = await verifyEmail({ token });
    if(error){
      this.message = error.msg;
      this.phase = 'error';
      return;
    }
    this.phase = 'success';
    setTimeout(() => { window.location.href = this.redirect; }, 2000);
  };

  /*
    Rendering
  */

  renderLightDom(){
    if(this.phase === 'success'){
      return html`<div class="ta-center"><h2>Email Verified!</h2><p>Your email has been successfully verified. Redirecting you to your account...</p></div>`;
    }
    if(this.phase === 'error'){
      return html`
        <div class="ta-center">
          <h2>Verification Failed</h2>
          <p class="tc-danger">${this.message}</p>
          <p class="mt"><a href=${this.loginHref} class="btn">Go to Login</a></p>
        </div>
      `;
    }
    return html`<div class="ta-center"><h2>Verifying Your Email...</h2><p>Please wait while we verify your email address.</p></div>`;
  }
}

customElements.define('k-verify-email', VerifyEmail);
