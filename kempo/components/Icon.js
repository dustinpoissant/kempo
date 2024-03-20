import Component from './Component.js';

export default class Icon extends Component {
  constructor(){
    super();
    this.registerAttributes({
      src: '',
      name: ''
    });
  }
  async render(force){
    if(await super.render(force)){
      if(this.src){
        this.innerHTML = await (await fetch(this.src)).text();
        this.fixSVG();
      } else if(this.name){
        this.innerHTML = await (await fetch(`${Icon.pathToIcons}/${this.name}.svg`)).text();
        this.fixSVG();
      } else {
        this.rendered = false;
        this.innerHTML = '';
      }
      return true;
    }
    return false;
  }
  attributeChangedCallback(n, oV, nV){
    if(['src', 'name'].includes(n)){
      this.render(true);
    }
  }
  fixSVG(){
    const $svg = this.querySelector('svg');
    $svg.removeAttribute('width');
    $svg.removeAttribute('height');
    $svg.querySelectorAll('path, rect, circle').forEach( $path => {
      $path.setAttribute('fill', 'currentColor');
    });
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

  static observedAttributes = [
    'name',
    'src'
  ];

  static pathToIcons = '/icons';
}
window.customElements.define('k-icon', Icon);
