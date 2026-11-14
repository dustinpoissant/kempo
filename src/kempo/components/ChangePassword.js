import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';
import '/kempo-ui/components/Dialog.js';
import '/kempo-ui/components/Toggle.js';
import { changePassword } from '../sdk.js';
import { refresh } from '../notifications/client.js';

/*
  The form that changes the signed-in person's password, in a dialog: the current password, the new one twice, and whether to
  log out the other devices.

  Two elements, both lives in kempo so an update reaches every site:

  - `<k-change-password-dialog>` is the dialog alone, opened with `open()`. The Change password button widget is a plain
    `<button data-change-password>` (see ChangePasswordButton.js) that opens it.
  - `<k-change-password>` is a button and the dialog together, for a page that wants nothing else. `label` is the button's
    text (default `Change Password`) and `button-class` its classes (default `btn`).
*/
class ChangePasswordDialog extends LightComponent {
  /*
    Events
  */

  open = async () => {
    await this.updateComplete;
    this.querySelector('k-dialog').open();
  };

  submit = async event => {
    event.preventDefault();
    const form = event.target;
    const confirm = form.elements.confirmPassword;
    if(form.elements.newPassword.value !== confirm.value){
      confirm.classList.add('error');
      confirm.setCustomValidity('Your new password and confirmation password do not match');
      confirm.reportValidity();
      return;
    }
    this.querySelector('k-dialog').close();
    const [error] = await changePassword({
      currentPassword: form.elements.currentPassword.value,
      newPassword: form.elements.newPassword.value,
      logoutAll: form.querySelector('k-toggle').value,
    });
    if(error){
      Toast.error(error.msg);
      return;
    }
    form.reset();
    refresh();
  };

  clearMismatch = event => {
    event.target.classList.remove('error');
    event.target.setCustomValidity('');
  };

  /*
    Rendering
  */

  renderDialog(){
    return html`
      <k-dialog>
        <h5 slot="title" class="pyh px m0">Change Password</h5>
        <form class="p" @submit=${this.submit}>
          <div class="mb">
            <label for="k-change-current" class="d-b mb-sm">Current Password</label>
            <input type="password" id="k-change-current" name="currentPassword" required class="w-full p-sm br">
          </div>
          <div class="mb">
            <label for="k-change-new" class="d-b mb-sm">New Password</label>
            <input type="password" id="k-change-new" name="newPassword" required minlength="8" class="w-full p-sm br">
          </div>
          <div class="mb">
            <label for="k-change-confirm" class="d-b mb-sm">Confirm New Password</label>
            <input type="password" id="k-change-confirm" name="confirmPassword" required minlength="8" class="w-full p-sm br" @input=${this.clearMismatch}>
          </div>
          <k-toggle>Logout all other devices</k-toggle>
          <div class="ta-right">
            <button type="submit" class="primary">Change Password</button>
          </div>
        </form>
      </k-dialog>
    `;
  }

  renderLightDom(){
    return this.renderDialog();
  }
}

class ChangePassword extends ChangePasswordDialog {
  static properties = {
    label: { type: String },
    buttonClass: { type: String, attribute: 'button-class' },
  };

  constructor(){
    super();
    this.label = 'Change Password';
    this.buttonClass = 'btn';
  }

  renderLightDom(){
    return html`
      <button type="button" class=${this.buttonClass} @click=${this.open}>${this.label}</button>
      ${this.renderDialog()}
    `;
  }
}

customElements.define('k-change-password-dialog', ChangePasswordDialog);
customElements.define('k-change-password', ChangePassword);
