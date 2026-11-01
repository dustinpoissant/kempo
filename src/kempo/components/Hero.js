import Widget from '/kempo/sitebuilder/components/Widget.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

const HEIGHTS = { full: '100vh', tall: '70vh', medium: '40vh' };

/*
  <k-hero image="/media/banner.jpg" height="tall" overlay="40"> ...widgets... </k-hero>
  A large background image with content on top of it. `overlay` is how dark the image is made (0 to 90) so the text on
  it can be read.
*/
export default class Hero extends Widget {
  static properties = {
    image: { type: String, reflect: true },
    height: { type: String, reflect: true },
    overlay: { type: Number, reflect: true }
  };

  constructor(){
    super();
    this.image = '';
    this.height = 'tall';
    this.overlay = 40;
  }

  static styles = css`
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
  `;

  imageStyle(){
    const url = /^(https?:\/\/|\/(?!\/))[^"'()\s]*$/i.test(this.image || '') ? `background-image: url("${this.image}");` : '';
    return `min-height: ${HEIGHTS[this.height] || HEIGHTS.tall}; ${url}`;
  }

  render(){
    const overlay = Math.min(90, Math.max(0, Number(this.overlay) || 0)) / 100;
    return html`
      <div class="hero" style="${this.imageStyle()}">
        <div class="shade" style="background: rgb(0 0 0 / ${overlay});"></div>
        <div class="content"><slot></slot></div>
      </div>
    `;
  }
}

customElements.define('k-hero', Hero);
