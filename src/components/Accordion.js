import Component from './Component.js';
import {
  onEvent,
  offEvent,
  dispatchEvent
} from '../utils/element.js';
import raf from '../utils/raf.js';

export default class Accordion extends Component {
  constructor(){
    super();
    
    /* Init */
    this.unrender = true;
  }

  /* Public Members */
  get activeHeader(){
    return this.querySelector('k-accordion-header[active="true"]');
  }
  get activePanel(){
    return this.querySelector('k-accordion-panel[active="true"]');
  }

  /* Public Methods */
  getHeader(panelName){
    return this.querySelector(`k-accordion-header[for-panel="${panelName}"]`);
  }
  getPanel(panelName){
    return this.querySelector(`k-accordion-panel[name="${panelName}"]`);
  }
  openPanel(panelName){
    const $currentlyActivePanel = this.querySelector(`k-accordion-panel[active="true"]`);
    if($currentlyActivePanel && $currentlyActivePanel.name !== panelName){
      $currentlyActivePanel.active = false;
      const $currnetlyActiveHeader = this.getHeader($currentlyActivePanel.name);
      if($currnetlyActiveHeader) $currnetlyActiveHeader.active = false;
    }
    const $panel = this.getPanel(panelName);
    if($panel){
      $panel.active = true;
      $panel.transitioning = true;
      setTimeout(() => {
        $panel.transitioning = false;
      }, parseInt(getComputedStyle(this).getPropertyValue('--animation_ms') || 256));
      const $header = this.getHeader(panelName);
      if($header) $header.active = true;
      dispatchEvent(this, 'openpanel', { panelName });
    }
  }
  closePanel(panelName){
    const $panel = this.getPanel(panelName);
    if($panel){
      $panel.active = false;
      $panel.transitioning = true;
      setTimeout(() => {
        $panel.transitioning = false;
      }, parseInt(getComputedStyle(this).getPropertyValue('--animation_ms') || 256) );
      const $header = this.getHeader(panelName);
      if($header) $header.active = false;
      dispatchEvent(this, 'closepanel', { panelName });
    }
  }
  togglePanel(panelName){
    const $panel = this.getPanel(panelName);
    if($panel){
      if($panel.active){
        this.closePanel(panelName);
      } else {
        this.openPanel(panelName);
      }
      dispatchEvent(this, 'togglepanel', { panelName });
    }
  }

  /* Shadow DOM */
  get shadowStyles(){
    return /*css*/`
      :host {
        display: block;
        border: 1px solid var(--c_border);
        border-radius: var(--radius);
      }
      ::slotted(k-accordion-header){
        border-top: 1px solid var(--c_border);
      }
      ::slotted(k-accordion-header[active="true"]) {
        border-bottom: 1px solid var(--c_border);
      }
      ::slotted(k-accordion-header:first-of-type) {
        border-top: 0;
      }
      ::slotted(k-accordion-header:last-of-type:not([active="true"])) {
        border-bottom: 0;
      }
    `;
  }
}
window.customElements.define('k-accordion', Accordion);

const clickHandler = Symbol();
export class AccordionHeader extends Component {
  constructor(label = 'Show More', forPanel = ''){
    super();

    /* Public Methods */
    this[clickHandler] = () => {
      this.accordion.togglePanel(this.forPanel);
    }
    
    /* Init */ 
    this.registerAttributes({
      forPanel,
      active: false
    });
  }

  /* Lifecycle Callbacks */
  async render(force){
    if(await super.render(force)){
      onEvent(this, 'click', this[clickHandler]);
      return true;
    }
    return false;
  }
  disconnectedCallback(){
    super.disconnectedCallback();
    offEvent(this, 'click', this[clickHandler]);
  }

  /* Protected Members */
  get accordion(){
    return this.closest('k-accordion');
  }

  /* Shadow DOM */
  get shadowStyles(){
    return /*css*/`
      :host {
        display: block;
        padding: 1rem;
        cursor: pointer;
      }
    `;
  }
}
window.customElements.define('k-accordion-header', AccordionHeader);

export class AccordionPanel extends Component {
  constructor(name = ''){
    super();
    
    /* Init */
    this.registerAttributes({
      name,
      active: false,
      transitioning: false
    });
  }
  
  /* Protected Members */
  get accordion(){
    return this.closest('k-accordion');
  }

  /* Shadow DOM */
  get shadowStyles(){
    return /*css*/`
      ${super.shadowStyles}
      :host {
        display: block;
        interpolate-size: allow-keywords;
        height: 0;
        overflow: hidden;
        transition: height var(--animation_ms) ease-in-out;
      }
      :host([active="true"]) {
        height: max-content;
      }
    `;
  }
}
window.customElements.define('k-accordion-panel', AccordionPanel);
