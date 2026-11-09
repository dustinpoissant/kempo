import e from"/kempo-ui/components/LightComponent.js";import{html as t}from"/kempo-ui/lit-all.min.js";import s from"/kempo-ui/components/Toast.js";export default class o extends e{static properties={homeHref:{type:String,attribute:"home-href"},email:{state:!0},code:{state:!0},codeSent:{state:!0},busy:{state:!0},deleted:{state:!0}};constructor(){super(),this.homeHref="/",this.email="",this.code="",this.codeSent=!1,this.busy=!1,this.deleted=!1}connectedCallback(){super.connectedCallback(),this.prefill()}prefill=async()=>{try{const e=await(await fetch("/kempo/api/auth/session")).json();e.user?.email&&!this.email&&(this.email=e.user.email)}catch{}};post=async(e,t)=>{const s=await fetch(`/kempo/api/auth/account-deletion/${e}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(t)});return{ok:s.ok,body:await s.json().catch(()=>({}))}};askForCode=async()=>{const e=await this.post("request",{email:this.email.trim()});e.ok?(this.codeSent=!0,s.success("If an account uses that address, a code is on its way"),await this.updateComplete,this.querySelector("#k-delete-code")?.focus()):s.error(e.body.error||"The code could not be sent")};deleteAccount=async()=>{this.busy=!0;const e=await this.post("confirm",{email:this.email.trim(),code:this.code});this.busy=!1,e.ok?this.deleted=!0:s.error(e.body.error||"That did not work")};renderLightDom(){return this.deleted?t`
        <div class="card mb">
          <h4>Your account has been deleted</h4>
          <p>Your name, email address, password and sign-in details are gone, and so is everything else this site kept about you. Thank you for having been here.</p>
          <a href=${this.homeHref}>Back to the home page</a>
        </div>
      `:t`
      <h2>Delete your account</h2>
      <p>This removes your account and everything this site keeps about you: your name, your email address, your password, your sign-in links to other providers, and your sessions. Other parts of this site may keep records they are required to keep, such as past orders.</p>
      <p class="tc-muted">We send a six-digit code to the email address on your account. Entering it proves that you control that address before anything is deleted.</p>

      <label class="d-b mbq" for="k-delete-email">Email address on your account</label>
      <input id="k-delete-email" type="email" autocomplete="email" class="full mb" .value=${this.email} @input=${e=>{this.email=e.target.value}} />
      <button class="primary" type="button" @click=${this.askForCode}>Send me a code</button>

      ${this.codeSent?t`
        <div class="mt">
          <label class="d-b mbq" for="k-delete-code">Code<small class="d-b tc-muted">Six digits. It works for 30 minutes.</small></label>
          <input id="k-delete-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="full mb" .value=${this.code} @input=${e=>{this.code=e.target.value.replace(/\D/g,""),e.target.value=this.code}} />
          <div class="d-f">
            <button class="danger mr" type="button" ?disabled=${this.busy||6!==this.code.length} @click=${this.deleteAccount}>Delete my account</button>
            <button class="link" type="button" @click=${this.askForCode}>Send a new code</button>
          </div>
        </div>
      `:""}
    `}}customElements.define("k-delete-account",o);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\DeleteAccount.js.map