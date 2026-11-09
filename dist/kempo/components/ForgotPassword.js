import e from"/kempo-ui/components/LightComponent.js";import{html as t}from"/kempo-ui/lit-all.min.js";import s from"/kempo-ui/components/Toast.js";import{forgotPassword as i}from"../sdk.js";export default class o extends e{static properties={loginHref:{type:String,attribute:"login-href"},sent:{state:!0},busy:{state:!0}};constructor(){super(),this.loginHref="/login",this.sent=!1,this.busy=!1}submit=async e=>{e.preventDefault(),this.busy=!0;const[t]=await i({email:new FormData(e.target).get("email")});this.busy=!1,t?s.error(t.msg):this.sent=!0};again=e=>{e.preventDefault(),this.sent=!1};renderLightDom(){return this.sent?t`
        <h2>Check Your Email</h2>
        <p>We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.</p>
        <p class="mt">The link will expire in 1 hour.</p>
        <p class="mt">Didn't receive the email? Check your spam folder or <a href="#" @click=${this.again}>try again</a>.</p>
        <p class="mt"><a href=${this.loginHref}>Back to Login</a></p>
      `:t`
      <h2>Forgot Password</h2>
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      <form @submit=${this.submit}>
        <label for="k-forgot-email">Email</label>
        <input type="email" id="k-forgot-email" name="email" required />
        <button type="submit" class="p-sm br mt" ?disabled=${this.busy}>${this.busy?"Sending...":"Send Reset Link"}</button>
      </form>
      <p class="mt">Remember your password? <a href=${this.loginHref}>Login</a></p>
    `}}customElements.define("k-forgot-password",o);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\ForgotPassword.js.map