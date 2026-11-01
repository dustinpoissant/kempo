import Widget from '/kempo/sitebuilder/components/Widget.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import { resolveEmbed } from '/kempo/sitebuilder/embedProviders.js';
import '/kempo-ui/components/Video.js';

/*
  <k-video-player src="..."> plays a video file with kempo-ui's player, or embeds a YouTube or Vimeo address with the
  provider's own player. Its attributes are the player's own (poster, controls, autoplay, loop, muted, preload) and the
  size: width (the most it takes, in pixels), align, ratio (an aspect ratio such as 16/9) and fit (cover crops a video
  file to the ratio). A video file starts muted when it plays by itself, as browsers only allow that.
*/
export default class VideoPlayer extends Widget {
  static properties = {
    src: { type: String, reflect: true },
    poster: { type: String, reflect: true },
    width: { type: Number, reflect: true },
    align: { type: String, reflect: true },
    ratio: { type: String, reflect: true },
    fit: { type: String, reflect: true },
    controls: { type: String, reflect: true },
    skip: { type: Number, reflect: true },
    neverHide: { type: Boolean, reflect: true, attribute: 'never-hide' },
    hideAfter: { type: Number, reflect: true, attribute: 'hide-after' },
    autoplay: { type: Boolean, reflect: true },
    loop: { type: Boolean, reflect: true },
    muted: { type: Boolean, reflect: true },
    remember: { type: Boolean, reflect: true },
    preload: { type: String, reflect: true }
  };

  constructor(){
    super();
    this.src = '';
    this.poster = '';
    this.width = 0;
    this.align = 'left';
    this.ratio = '';
    this.fit = '';
    this.controls = 'normal';
    this.skip = 10;
    this.neverHide = false;
    this.hideAfter = 3;
    this.autoplay = false;
    this.loop = false;
    this.muted = false;
    this.remember = false;
    this.preload = 'metadata';
  }

  static styles = css`
    :host { display: block; margin-bottom: var(--spacer, 1rem); }
    .box { width: 100%; }
    .box.center { margin-inline: auto; }
    .box.right { margin-inline-start: auto; }
    .frame { width: 100%; border: 0; display: block; }
    k-video.cover::part(video) { object-fit: cover; }
    .empty { padding: var(--spacer, 1rem); border: 1px dashed var(--c_border, #888); text-align: center; opacity: 0.7; }
  `;

  render(){
    if(!this.src) return html`<div class="empty">Choose a video.</div>`;
    const ratio = this.ratio ? this.ratio.replace('/', ' / ') : '';
    const embed = resolveEmbed(this.src, { autoplay: this.autoplay, muted: this.muted, loop: this.loop, controls: this.controls !== '' });
    const size = this.width > 0 ? `max-width: ${this.width}px` : '';
    const idleDelay = this.neverHide ? '999999999' : `${this.hideAfter * 1000}`;
    return html`
      <div class="box ${this.align === 'center' || this.align === 'right' ? this.align : ''}" style="${size}">
        ${embed
          ? html`<iframe class="frame" style="aspect-ratio: ${ratio || embed.ratio};" src="${embed.src}" title="${embed.provider} video" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>`
          : html`<k-video class="${this.fit === 'cover' ? 'cover' : ''}" style="${ratio ? `aspect-ratio: ${ratio}` : ''}" src="${this.src}" poster="${this.poster || ''}" controls="${this.controls}" skip-duration="${this.skip}" idle-delay-ms="${idleDelay}" preload="${this.preload}" persistent-id="${this.remember ? this.src : ''}" ?autoplay="${this.autoplay}" ?loop="${this.loop}" ?muted="${this.muted || this.autoplay}"></k-video>`}
      </div>`;
  }
}

customElements.define('k-video-player', VideoPlayer);
