import Widget from '/kempo/sitebuilder/components/Widget.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import { resolveEmbed } from '/kempo/sitebuilder/embedProviders.js';

/*
  <k-embed src="https://youtu.be/..." title="..."> builds the iframe itself for an address one of the allowed
  providers (see embedProviders.js) can embed. Any other address shows nothing, so the page file never holds an iframe
  of its own and no other site can be framed into a page.
*/
export default class Embed extends Widget {
  static properties = {
    src: { type: String, reflect: true },
    title: { type: String, reflect: true }
  };

  constructor(){
    super();
    this.src = '';
    this.title = '';
  }

  static styles = css`
    :host { display: block; margin-bottom: var(--spacer, 1rem); }
    .frame { width: 100%; border: 0; display: block; }
    .empty { padding: var(--spacer, 1rem); border: 1px dashed var(--c_border, #888); text-align: center; opacity: 0.7; }
  `;

  render(){
    const embed = resolveEmbed(this.src);
    if(!embed) return html`<div class="empty">Paste a YouTube, Vimeo or Spotify address.</div>`;
    return html`<iframe class="frame" style="aspect-ratio: ${embed.ratio};" src="${embed.src}" title="${this.title || `${embed.provider} embed`}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>`;
  }
}

customElements.define('k-embed', Embed);
