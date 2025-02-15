import LazyComponent from './LazyComponent.js';
import { onEvent } from '../utils/element.js';

export default class FocusCapture extends LazyComponent {
  constructor(){
    super({
      delegatesFocus: true
    }); 
  }
  render(){
    super.render();
    onEvent(this.shadowRoot.getElementById('after'), 'focus', () => {
      this.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').focus();
    });
  }
  
  get shadowTemplate(){
    return /*html*/`
      ${super.shadowTemplate}
      <div id="after" tabindex="0"></div>
    `;
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        display: inline-block;
      }
    `;
  }
}
window.customElements.define('k-focus-capture', FocusCapture);
