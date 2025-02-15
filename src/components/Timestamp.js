import Component from './Component.js'
import formatTimestamp from '../utils/formatTimestamp.js';

export default class Timestamp extends Component {
	constructor(timestamp = 0, format = '', locale = ''){
		super();
		this.registerAttributes({
			timestamp,
			locale,
			format
		});
	}

	/* Lifecycle Callbacks */
	attributeChangedCallback(n, oV, nV){
		if(n == 'timestamp'){
			if(nV){
				this.innerHTML = formatTimestamp(nV, this.format, this.locale || navigator.language);
			} else {
				this.innerHTML = '';
			}
		}
	}

	/* Static Members */
	static observedAttributes = ['timestamp'];
}
window.customElements.define('k-timestamp', Timestamp);
