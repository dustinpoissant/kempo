import e from"/kempo/sitebuilder/components/Widget.js";import{html as t,css as i}from"/kempo-ui/lit-all.min.js";const s={full:"100vh",tall:"70vh",medium:"40vh"};export default class r extends e{static properties={image:{type:String,reflect:!0},height:{type:String,reflect:!0},overlay:{type:Number,reflect:!0}};constructor(){super(),this.image="",this.height="tall",this.overlay=40}static styles=i`
    :host { display: block; }
    .hero {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background-size: cover;
      background-position: center;
      background-color: var(--c_bg__alt, #444);
      color: #fff;
      overflow: hidden;
    }
    .shade { position: absolute; inset: 0; }
    .content { position: relative; width: 100%; padding: var(--spacer, 1rem); text-align: center; }
  `;imageStyle(){const e=/^(https?:\/\/|\/(?!\/))[^"'()\s]*$/i.test(this.image||"")?`background-image: url("${this.image}");`:"";return`min-height: ${s[this.height]||s.tall}; ${e}`}render(){const e=Math.min(90,Math.max(0,Number(this.overlay)||0))/100;return t`
      <div class="hero" style="${this.imageStyle()}">
        <div class="shade" style="background: rgb(0 0 0 / ${e});"></div>
        <div class="content"><slot></slot></div>
      </div>
    `}}customElements.define("k-hero",r);
//# sourceMappingURL=c:\Users\dusti\dev\kempo\dist\kempo\components\Hero.js.map