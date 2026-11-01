import Widget from '/kempo/sitebuilder/components/Widget.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

const NETWORKS = [
  ['facebook', 'Facebook', 'link'],
  ['x', 'X', 'link'],
  ['instagram', 'Instagram', 'link'],
  ['youtube', 'YouTube', 'link'],
  ['linkedin', 'LinkedIn', 'link'],
  ['tiktok', 'TikTok', 'link'],
  ['github', 'GitHub', 'github-mark']
];

const SAFE = /^https?:\/\//i;

/*
  <k-social-icons github="https://github.com/you" x="https://x.com/you"> is a row of links to social profiles. Only the
  profiles that have an address are shown.
*/
export default class SocialIcons extends Widget {
  static properties = Object.fromEntries(NETWORKS.map(([name]) => [name, { type: String, reflect: true }]));

  constructor(){
    super();
    for(const [name] of NETWORKS) this[name] = '';
  }

  static styles = css`
    :host { display: block; margin-bottom: var(--spacer, 1rem); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--spacer_h, 0.5rem) var(--spacer, 1rem); }
    a { display: inline-flex; align-items: center; gap: var(--spacer_q, 0.25rem); }
  `;

  render(){
    const links = NETWORKS.filter(([name]) => SAFE.test(this[name] || ''));
    if(!links.length) return html`<span class="tc-muted">Add the addresses of your profiles.</span>`;
    return html`<ul>${links.map(([name, label, icon]) => html`<li><a href="${this[name]}" target="_blank" rel="noopener noreferrer"><k-icon name="${icon}"></k-icon>${label}</a></li>`)}</ul>`;
  }
}

customElements.define('k-social-icons', SocialIcons);
