import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';

/*
  The form that deletes an account and what the site keeps about the person. It sends a six-digit code to the email
  address on the account, and nothing is deleted until the code comes back, which proves the person controls that address.
  When someone is signed in their address is filled in.

  Lives in kempo so an update reaches every site. `home-href` is where "Back to the home page" goes (default `/`).
*/
export default class DeleteAccount extends LightComponent {
  static properties = {
    homeHref: { type: String, attribute: 'home-href' },
    email: { state: true },
    code: { state: true },
    codeSent: { state: true },
    busy: { state: true },
    deleted: { state: true },
  };

  constructor(){
    super();
    this.homeHref = '/';
    this.email = '';
    this.code = '';
    this.codeSent = false;
    this.busy = false;
    this.deleted = false;
  }

  /*
    Lifecycle
  */

  connectedCallback(){
    super.connectedCallback();
    this.prefill();
  }

  /* Fills in the address of whoever is signed in; not signed in, the person types it. */
  prefill = async () => {
    try {
      const data = await (await fetch('/kempo/api/auth/session')).json();
      if(data.user?.email && !this.email) this.email = data.user.email;
    } catch {
      /* no session to read */
    }
  };

  /*
    Events
  */

  post = async (path, body) => {
    const response = await fetch(`/kempo/api/auth/account-deletion/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: response.ok, body: await response.json().catch(() => ({})) };
  };

  askForCode = async () => {
    const result = await this.post('request', { email: this.email.trim() });
    if(!result.ok){
      Toast.error(result.body.error || 'The code could not be sent');
      return;
    }
    this.codeSent = true;
    Toast.success('If an account uses that address, a code is on its way');
    await this.updateComplete;
    this.querySelector('#k-delete-code')?.focus();
  };

  deleteAccount = async () => {
    this.busy = true;
    const result = await this.post('confirm', { email: this.email.trim(), code: this.code });
    this.busy = false;
    if(!result.ok){
      Toast.error(result.body.error || 'That did not work');
      return;
    }
    this.deleted = true;
  };

  /*
    Rendering
  */

  renderLightDom(){
    if(this.deleted){
      return html`
        <div class="card mb">
          <h4>Your account has been deleted</h4>
          <p>Your name, email address, password and sign-in details are gone, and so is everything else this site kept about you. Thank you for having been here.</p>
          <a href=${this.homeHref}>Back to the home page</a>
        </div>
      `;
    }
    return html`
      <h2>Delete your account</h2>
      <p>This removes your account and everything this site keeps about you: your name, your email address, your password, your sign-in links to other providers, and your sessions. Other parts of this site may keep records they are required to keep, such as past orders.</p>
      <p class="tc-muted">We send a six-digit code to the email address on your account. Entering it proves that you control that address before anything is deleted.</p>

      <label class="d-b mbq" for="k-delete-email">Email address on your account</label>
      <input id="k-delete-email" type="email" autocomplete="email" class="full mb" .value=${this.email} @input=${event => { this.email = event.target.value; }} />
      <button class="primary" type="button" @click=${this.askForCode}>Send me a code</button>

      ${this.codeSent ? html`
        <div class="mt">
          <label class="d-b mbq" for="k-delete-code">Code<small class="d-b tc-muted">Six digits. It works for 30 minutes.</small></label>
          <input id="k-delete-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="full mb" .value=${this.code} @input=${event => { this.code = event.target.value.replace(/\D/g, ''); event.target.value = this.code; }} />
          <div class="d-f">
            <button class="danger mr" type="button" ?disabled=${this.busy || this.code.length !== 6} @click=${this.deleteAccount}>Delete my account</button>
            <button class="link" type="button" @click=${this.askForCode}>Send a new code</button>
          </div>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('k-delete-account', DeleteAccount);
