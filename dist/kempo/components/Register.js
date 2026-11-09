import e from"/kempo-ui/components/LightComponent.js";import{html as r}from"/kempo-ui/lit-all.min.js";import s from"/kempo-ui/components/Toast.js";import{register as t}from"../sdk.js";import i from"../utils/safeNext.js";export default class a extends e{static properties={redirect:{type:String},verifyRedirect:{type:String,attribute:"verify-redirect"}};constructor(){super(),this.redirect="/account",this.verifyRedirect="/verify-email",this.extra=[]}connectedCallback(){this.extra.length||(this.extra=[...this.childNodes]),this.extra.forEach(e=>e.remove()),super.connectedCallback()}submit=async e=>{e.preventDefault();const r=e.target.elements.confirmPassword;if(e.target.elements.password.value!==r.value)return r.classList.add("error"),r.setCustomValidity("The passwords do not match"),void r.reportValidity();const a=new FormData(e.target),[o,m]=await t({name:a.get("name"),email:a.get("email"),password:a.get("password")});o?s.error(o.msg):window.location.href=m.requiresVerification?this.verifyRedirect:i(new URLSearchParams(window.location.search).get("next"))||this.redirect};clearMismatch=e=>{e.target.classList.remove("error"),e.target.setCustomValidity("")};renderLightDom(){return r`
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
        <div class="mb">
          <label for="k-register-confirm" class="d-b mb-sm">Confirm Password</label>
          <input type="password" id="k-register-confirm" name="confirmPassword" required class="w-full p-sm br" @input=${this.clearMismatch}>
        </div>
        <button type="submit" class="w-full p-sm br">Register</button>
      </form>
      ${this.extra}
      <p class="mt">Already have an account? <a href="/login">Login</a></p>
    `}}customElements.define("k-register",a);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\Register.js.map