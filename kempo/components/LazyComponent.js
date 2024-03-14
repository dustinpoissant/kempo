import Component from './Component.js';
import { isInView } from '../utils/element.js';


export default class LazyComponent extends Component {
  constructor(){
    super();
    (new IntersectionObserver(([comp]) => {
      if(comp.intersectionRatio > 0 && !this.rendered){
        this.inViewCallback();
      } else {
        this.outOfViewCallback();
      }
    })).observe(this);
    
    this.registerAttribute('unrender', false);
  }
  async connectedCallback(){
    // Do not do super.connectedCallback() because it will render the component prematurely
    await this.renderSkelton(); // so that the skeleton height is rendered, which will give it the propert height so potentional LazyComponents below it will get out of the viewport as they normally would, before we then check if it is in View (which is delayed a few frames.
    if(await isInView(this)){
      await this.inViewCallback();
    }
  }
  async inViewCallback(){
    await this.render();
  }
  async outOfViewCallback(){
    if(this.unrender){
      await this.renderSkelton();
    }
  }
  async renderSkelton(){
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="/kempo/kempo.css" />${this.skeletonTemplate}<style>${this.shadowStyles}</style>`;
    this.rendered = false;
  }
  get skeletonTemplate(){
    return /*html*/`<div style="height: var(--skeleton_height, 1rem)"></div>`;
  }
}