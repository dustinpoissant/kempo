import Component from './Component.js';

export default class ReactiveComponent extends Component {
  attributeChangedCallback(n, oV, nV){
    super.attributeChangedCallback(n, oV, nV);
    if(this.constructor.renderOnChange.includes(n)){
      this.render(true);
    }
  }
  static renderOnChange = [];
}