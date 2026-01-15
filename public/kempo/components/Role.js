import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { checkRole } from '../sdk.js';

export default class Role extends LightComponent {
	static properties = {
		requires: { type: String },
		exclude: { type: String },
		loading: { type: Boolean, state: true },
		hasRole: { type: Boolean, state: true }
	};

	constructor() {
		super();
		this.requires = '';
		this.exclude = '';
		this.loading = true;
		this.hasRole = false;
	}

	async connectedCallback() {
		super.connectedCallback();
		await this.checkRole();
	}

	async checkRole() {
		try {
			const data = await checkRole({
				requires: this.requires || undefined,
				exclude: this.exclude || undefined
			});
			this.hasRole = data.hasRole;
		} catch(error) {
			console.error('Role check failed:', error);
			this.hasRole = false;
		} finally {
			this.loading = false;
		}
	}

	renderLightDom() {
		if(this.loading) {
			return html``;
		}

		if(!this.hasRole) {
			return html``;
		}

		return html`<slot></slot>`;
	}
}

window.customElements.define('k-role', Role);
