import Login from '/kempo/components/Login.js';
import Register from '/kempo/components/Register.js';
import ForgotPassword from '/kempo/components/ForgotPassword.js';
import ResetPassword from '/kempo/components/ResetPassword.js';
import DeleteAccount from '/kempo/components/DeleteAccount.js';
import VerifyEmail from '/kempo/components/VerifyEmail.js';
import Permission from '/kempo/components/Permission.js';

/*
  The core widgets as the page builder shows them: the same elements, drawn by the same components, that never do what
  they are for. A form shows its fields but sends nothing, and the logout button does not sign anyone out, so working
  on a page never changes the session of whoever is editing it. What is inside Show for permission is always shown, so it can be edited whatever the editor may see.
*/
const nothing = async () => {};

class LoginEditor extends Login {
  submit = event => event.preventDefault();
}

class RegisterEditor extends Register {
  submit = event => event.preventDefault();
}

class ForgotPasswordEditor extends ForgotPassword {
  submit = event => event.preventDefault();
}

class ResetPasswordEditor extends ResetPassword {
  submit = event => event.preventDefault();
}

class VerifyEmailEditor extends VerifyEmail {
  verify = nothing;
}

class DeleteAccountEditor extends DeleteAccount {
  prefill = nothing;

  askForCode = nothing;

  deleteAccount = nothing;
}

class PermissionEditor extends Permission {
  checkPermissions = async () => {
    this.hasPermission = true;
    this.loading = false;
  };
}

customElements.define('k-login-editor', LoginEditor);
customElements.define('k-register-editor', RegisterEditor);
customElements.define('k-forgot-password-editor', ForgotPasswordEditor);
customElements.define('k-reset-password-editor', ResetPasswordEditor);
customElements.define('k-verify-email-editor', VerifyEmailEditor);
customElements.define('k-delete-account-editor', DeleteAccountEditor);
customElements.define('k-permission-editor', PermissionEditor);
