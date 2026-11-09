import e from"/kempo-ui/components/LightComponent.js";import{html as s}from"/kempo-ui/lit-all.min.js";import t from"/kempo-ui/components/Toast.js";import"/kempo-ui/components/Toggle.js";import{resetPassword as o}from"../sdk.js";export default class r extends e{static properties={token:{type:String},redirect:{type:String}};constructor(){super(),this.token="",this.redirect="/account"}submit=async e=>{e.preventDefault();const s=e.target,r=s.elements.password.value;if(r!==s.elements["confirm-password"].value)return void t.error("Passwords do not match");if(r.length<8)return void t.error("Password must be at least 8 characters");const i=this.token||decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop()??""),[a]=await o({password:r,token:i,logoutAll:s.querySelector("k-toggle").value});a?t.error(a.msg):(t.success("Password reset successful! Redirecting..."),setTimeout(()=>{window.location.href=this.redirect},1500))};renderLightDom(){return s`
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
    `}}customElements.define("k-reset-password",r);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\ResetPassword.js.map