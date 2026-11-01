import e from"/kempo/sitebuilder/components/Widget.js";import{html as t,css as r}from"/kempo-ui/lit-all.min.js";import i from"/kempo-ui/components/Audio.js";export default class o extends e{static properties={src:{type:String,reflect:!0},controls:{type:String,reflect:!0},loop:{type:Boolean,reflect:!0},autoplay:{type:Boolean,reflect:!0},muted:{type:Boolean,reflect:!0},remember:{type:Boolean,reflect:!0},preload:{type:String,reflect:!0},skip:{type:Number,reflect:!0},neverHide:{type:Boolean,reflect:!0,attribute:"never-hide"},hideAfter:{type:Number,reflect:!0,attribute:"hide-after"}};constructor(){super(),this.src="",this.controls="normal",this.loop=!1,this.autoplay=!1,this.muted=!1,this.remember=!1,this.preload="metadata",this.skip=10,this.neverHide=!1,this.hideAfter=3}static styles=r`
    :host { display: block; margin-bottom: var(--spacer, 1rem); }
    .empty { padding: var(--spacer, 1rem); border: 1px dashed var(--c_border, #888); text-align: center; opacity: 0.7; }
  `;render(){if(!this.src)return t`<div class="empty">Choose an audio file.</div>`;const e=this.neverHide?"999999999":""+1e3*this.hideAfter;return t`
      <k-audio
        src="${this.src}"
        controls="${this.controls}"
        skip-duration="${this.skip}"
        idle-delay-ms="${e}"
        preload="${this.preload}"
        persistent-id="${this.remember?this.src:""}"
        ?autoplay="${this.autoplay}"
        ?loop="${this.loop}"
        ?muted="${this.muted||this.autoplay}"
      ></k-audio>`}}customElements.define("k-audio-player",o);
//# sourceMappingURL=C:\Users\dusti\dev\kempo\dist\kempo\components\AudioPlayer.js.map