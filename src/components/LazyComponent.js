import Component from './Component.js';
import { isInView } from '../utils/element.js';
import raf from '../utils/raf.js';

export default class LazyComponent extends Component {
  constructor(shadowDetails){
    super(shadowDetails);
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
    raf(async ()=>{
      if(await isInView(this)) await this.inViewCallback();
    }, 2);
  }
  async inViewCallback(){
    return await this.render();
  }
  async outOfViewCallback(){
    if(this.unrender){
      await this.renderSkelton();
      return true;
    }
    return false;
  }
  async renderSkelton(){
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${Component.pathToKempo}/kempo-styles.css" />${this.skeletonTemplate}<style>${this.shadowStyles}</style>`;
    this.rendered = false;
    return true;
  }
  get skeletonTemplate(){
    return /*html*/`<div style="height: var(--skeleton_height, 1rem)"></div>`;
  }
}