import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { cleanMargin } from '/kempo/sitebuilder/margins.js';

const CHOICES = [['', 'None'], ['q', '¼'], ['h', '½'], ['f', 'Full'], ['a', 'Auto']];

/*
  A widget's margin as a box with a choice on each side: none, a quarter, a half or a whole space. It is in the settings
  of every widget, under the widget's own settings.
*/
export default class SitebuilderMargin extends ShadowComponent {
  static properties = {
    node: { attribute: false },
    host: { attribute: false },
    version: { type: Number }
  };

  setSide(side, value){
    this.host.setAttribute(this.node.id, 'margin', { ...cleanMargin(this.node.attrs?.margin), [side]: value }, false);
  }

  render(){
    if(!this.node) return '';
    const margin = cleanMargin(this.node.attrs?.margin);
    const choice = side => html`
      <select class="full" aria-label="Margin ${side}" title="Margin ${side}" @change="${event => this.setSide(side, event.target.value)}">
        ${CHOICES.map(([value, label]) => html`<option value="${value}" ?selected="${margin[side] === value}">${label}</option>`)}
      </select>`;
    return html`
      <div class="mb">
        <label class="d-b mbq">Margin<small class="d-b tc-muted">The space outside the widget on each side: none, a quarter, a half, a whole space or auto. Auto on left and right centers a widget that is narrower than its place.</small></label>
        <div class="d-g" style="grid-template-columns: 1fr 1.5fr 1fr; gap: var(--spacer_q); align-items: center;">
          <span></span>${choice('top')}<span></span>
          ${choice('left')}<div class="b r p ta-center tc-muted">Widget</div>${choice('right')}
          <span></span>${choice('bottom')}<span></span>
        </div>
      </div>
    `;
  }
}

customElements.define('admin-sitebuilder-margin', SitebuilderMargin);
