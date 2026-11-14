import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Toggle.js';
import { resetPassword } from '../sdk.js';
import { refresh } from '../notifications/client.js';

/*
  The reset password form, for the page the emailed link opens (/reset-password/<token>). It asks for a new password
  twice, and for whether to log out the other devices.

  Lives in kempo so an update reaches every site. `token` is the one in the link; without it the last part of the page's
  address is used, which is where the link puts it. `redirect` is where to go after (default `/account`).
*/
export default class ResetPassword extends LightComponent {
  static properties = {
    token: { type: String },
    redirect: { type: String },
  };

  constructor(){
    super();
    this.token = '';
    this.redirect = '/account';
  }

  /*
    Events
  */

  submit = async event => {
    event.preventDefault();
    const form = event.target;
    const password = form.elements.password.value;
    if(password !== form.elements['confirm-password'].value){
      Toast.error('Passwords do not match');
      return;
    }
    if(password.length < 8){
      Toast.error('Password must be at least 8 characters');
      return;
    }
    const token = this.token || decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() ?? '');
    const [error] = await resetPassword({ password, token, logoutAll: form.querySelector('k-toggle').value });
    if(error){
      Toast.error(error.msg);
      return;
    }
    refresh();
    setTimeout(() => { window.location.href = this.redirect; }, 1500);
  };

  /*
    Rendering
  */

  renderLightDom(){
    return html`
      <h2>Reset Password</h2>
      <form @submit=${this.submit}>
        <div class="mb">
          <label for="k-reset-password" class="d-b mb-sm">New Password</label>
          <input type="password" id="k-reset-password" name="password" required minlength="8" class="w-full p-sm br">
        </div>
        <div class="mb">
          <label for="k-reset-confirm" class="d-b mb-sm">Confirm Password</label>
          <input type="password" id="k-reset-confirm" name="confirm-password" required minlength="8" class="w-full p-sm br">
        </div>
        <div class="mb">
          <k-toggle>Log out all other devices</k-toggle>
        </div>
        <button type="submit" class="w-full p-sm br">Reset Password</button>
      </form>
      <p class="mt"><a href="/login">Back to Login</a></p>
    `;
  }
}

customElements.define('k-reset-password', ResetPassword);
