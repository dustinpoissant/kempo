import e from"/kempo-ui/components/LightComponent.js";import{html as s}from"/kempo-ui/lit-all.min.js";import t from"/kempo-ui/components/Toast.js";import{login as r}from"../sdk.js";import o from"../utils/safeNext.js";export default class a extends e{static properties={redirect:{type:String}};constructor(){super(),this.redirect="/account",this.extra=[]}connectedCallback(){this.extra.length||(this.extra=[...this.childNodes]),this.extra.forEach(e=>e.remove()),super.connectedCallback()}submit=async e=>{e.preventDefault();const s=new FormData(e.target),[a]=await r({email:s.get("email"),password:s.get("password")});a?t.error(a.msg):window.location.href=o(new URLSearchParams(window.location.search).get("next"))||this.redirect};renderLightDom(){return s`
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
    `}}customElements.define("k-login",a);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\Login.js.map