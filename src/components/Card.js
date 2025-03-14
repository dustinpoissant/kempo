import Component from './Component.js';
import {
  setProp
} from '../utils/element.js';

export default class Card extends Component {
  constructor(label = ''){
    super();

    this.registerAttribute('label', label);
  }
  attributeChangedCallback(n, oV, nV){
    if(n === 'label'){
      setProp(this.shadowRoot.getElementById('label'), 'innerHTML', nV);
    }
  }
  get shadowTemplate(){
    return /*html*/`
      <div id="card">
        <div id="label">${this.label}</div>
        ${super.shadowTemplate}
      </div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        display: block;
      }
      #card {
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        margin-bottom: var(--spacer);
        padding: var(--spacer);
        position: relative;
        background-color: var(--c_bg);
      }
      #label {
        position: absolute;
        top: -1.25em;
        left: 1.25em;
        background-color: var(--c_bg);
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
        padding: var(--spacer_h);
      }
      :host([label]) {
        padding-top: calc(1.5 * var(--spacer));
        margin-top: var(--spacer);
      }
      :host([label]) #card {
        padding-top: calc(1.5 * var(--spacer));
      }
      :host(:not([label])) #label {
        display: none;
      }

    `;
  }
  static observedAttributes = [...super.observedAttributes, 'label'];
}
window.customElements.define('k-card', Card);
