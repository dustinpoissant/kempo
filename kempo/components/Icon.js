import Component from './Component.js';

export default class Icon extends Component {
  constructor(){
    super();
    this.registerAttribute('src', '');
    this.registerAttribute('name', '');
  }
  async render(force){
    if(await super.render(force)){
      if(this.src){
        this.innerHTML = await (await fetch(src)).text();
      } else if(this.name){
        this.innerHTML = await (await fetch(`/kempo/icons/${this.name}.svg`)).text();
      } else {
        this.rendered = false;
        this.innerHTML = '';
      }
      return true;
    }
    return false;
  }
  attributeChangedCallback(n, oV, nV){
    if(n === 'src' && oV !== nV){
      this.render(true);
    }
  }
  get shadowStyles(){
    return /*css*/`
      :host {
        display: inline-block;
        vertical-align: bottom;
      }
      ::slotted(svg){
        height: 1.35em;
        vertical-align: middle;
      }
    `;
  }
}
window.customElements.define('k-icon', Icon);