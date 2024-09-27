import Component from './Component.js';

export default class Stacks extends Component {

  /* Public Members */
  get panels(){
    return [...this.querySelectorAll('k-stack-panel')];
  }

  /* Public Methods */
  reorderPanels(){
    const panels = this.panels;
    panels.reverse().forEach((panel, index) => panel.style.setProperty('--order', index));
  }

  /* Shadow DOM */
  get shadowStyles(){
    return /*css*/`
      :host {
        --stack_width: 16rem;
        display: block;
        height: 100%;
        position: relative;
      }
    `;
  }
}
window.customElements.define('k-stacks', Stacks);

export class StackPanel extends Component {
  constructor(){
    super();

    this.registerAttribute('stack', 0);
  }

  /* Lifecycle Callbacks */
  connectedCallback(){
    super.connectedCallback();
    const stacks = this.stacks;
    if(stacks) stacks.reorderPanels();
  }
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(n ==='stack' && oV !== nV){
      this.style.setProperty('--stack', nV);
    }
  }

  /* Protected Members */
  get stacks(){
    return this.closest('k-stacks');
  }


  /* Shadow DOM */
  get shadowStyles(){
    return /*css*/`
      :host {
        --stack: 0;
        display: block;
        height: 100%;
        width: var(--stack_width);
        position: absolute;
        top: 0;
        left: calc(var(--stack) * var(--stack_width));
        transition: left var(--animation_ms) ease-in-out;
        z-index: var(--order);
      }
    `;
  }

  /* Static Members */
  static observedAttributes = [
    ...super.observedAttributes,
    'stack'
  ];
}
window.customElements.define('k-stack-panel', StackPanel);