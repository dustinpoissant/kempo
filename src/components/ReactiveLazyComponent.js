import LazyComponent from './LazyComponent.js';

export default class ReactiveComponent extends LazyComponent {
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(this.constructor.renderOnChange.includes(n)){
      this.render(true);
    }
  }
  static renderOnChange = [];
}