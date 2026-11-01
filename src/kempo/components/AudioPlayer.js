import Widget from '/kempo/sitebuilder/components/Widget.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import Audio from '/kempo-ui/components/Audio.js';

export default class AudioPlayer extends Widget {
  static properties = {
    src: { type: String, reflect: true },
    controls: { type: String, reflect: true },
    loop: { type: Boolean, reflect: true },
    autoplay: { type: Boolean, reflect: true },
    muted: { type: Boolean, reflect: true },
    remember: { type: Boolean, reflect: true },
    preload: { type: String, reflect: true },
    skip: { type: Number, reflect: true },
    neverHide: { type: Boolean, reflect: true, attribute: 'never-hide' },
    hideAfter: { type: Number, reflect: true, attribute: 'hide-after' }
  };

  constructor(){
    super();
    this.src = '';
    this.controls = 'normal';
    this.loop = false;
    this.autoplay = false;
    this.muted = false;
    this.remember = false;
    this.preload = 'metadata';
    this.skip = 10;
    this.neverHide = false;
    this.hideAfter = 3;
  }

  static styles = css`
    :host { display: block; margin-bottom: var(--spacer, 1rem); }
    .empty { padding: var(--spacer, 1rem); border: 1px dashed var(--c_border, #888); text-align: center; opacity: 0.7; }
  `;

  render(){
    if(!this.src) return html`<div class="empty">Choose an audio file.</div>`;
    const idleDelay = this.neverHide ? '999999999' : `${this.hideAfter * 1000}`;
    return html`
      <k-audio
        src="${this.src}"
        controls="${this.controls}"
        skip-duration="${this.skip}"
        idle-delay-ms="${idleDelay}"
        preload="${this.preload}"
        persistent-id="${this.remember ? this.src : ''}"
        ?autoplay="${this.autoplay}"
        ?loop="${this.loop}"
        ?muted="${this.muted || this.autoplay}"
      ></k-audio>`;
  }
}

customElements.define('k-audio-player', AudioPlayer);
