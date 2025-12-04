import LightComponent from 'https://cdn.jsdelivr.net/npm/kempo-ui@0.0.42/dist/components/LightComponent.js';
import { html } from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';
import { checkPermissions } from '../auth.js';

export default class Permission extends LightComponent {
	static properties = {
		requires: { type: String },
		any: { type: Boolean },
		loading: { type: Boolean, state: true },
		hasPermission: { type: Boolean, state: true }
	};

	constructor() {
		super();
		this.requires = '';
		this.any = false;
		this.loading = true;
		this.hasPermission = false;
	}

	async connectedCallback() {
		super.connectedCallback();
		await this.checkPermissions();
	}

	async checkPermissions() {
		if(!this.requires) {
			this.hasPermission = true;
			this.loading = false;
			return;
		}

		const permissions = this.requires.split(',').map(p => p.trim());

		try {
			const data = await checkPermissions(permissions);
			
			if(this.any) {
				this.hasPermission = Object.values(data.permissions).some(v => v === true);
			} else {
				this.hasPermission = data.hasPermission;
			}
		} catch(error) {
			console.error('Permission check failed:', error);
			this.hasPermission = false;
		} finally {
			this.loading = false;
		}
	}

	renderLightDom() {
		if(this.loading) {
			return html``;
		}

		if(!this.hasPermission) {
			return html``;
		}

		return html`<slot></slot>`;
	}
}

window.customElements.define('k-permission', Permission);
