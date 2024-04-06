import Component from './Component.js'
import formatTimestamp from '../utils/formatTimestamp.js';

export default class Timestamp extends Component {
	constructor(timestamp){
		super();
		this.registerAttribute('timestamp', 0);
		if(timestamp) this.timestamp = timestamp;
	}

	/* Lifecycle Callbacks */
	attributeChangedCallback(n, oV, nV){
		if(n == 'timestamp'){
			if(nV){
				this.innerHTML = formatTimestamp(nV, 'en-US');
			} else {
				this.innerHTML = '';
			}
		}
	}

	/* Static Members */
	static observedAttributes = ['timestamp'];
}
window.customElements.define('k-timestamp', Timestamp);
