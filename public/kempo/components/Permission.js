import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { checkPermissionsAll, checkPermissionsSome } from '../sdk.js';

export default class Permission extends LightComponent {
	static properties = {
		all: { type: String },
		some: { type: String },
		loading: { type: Boolean, state: true },
		hasPermission: { type: Boolean, state: true }
	};

	constructor() {
		super();
		this.all = '';
		this.some = '';
		this.loading = true;
		this.hasPermission = false;
	}

	async connectedCallback() {
		super.connectedCallback();
		await this.checkPermissions();
	}

	async checkPermissions() {
		if(this.all && this.some) {
			console.error('Permission: Cannot use both "all" and "some" attributes');
			this.hasPermission = false;
			this.loading = false;
			return;
		}

		if(!this.all && !this.some) {
			this.hasPermission = true;
			this.loading = false;
			return;
		}

		const permissions = (this.all || this.some).split(',').map(p => p.trim());

		try {
			if(this.all) {
				const data = await checkPermissionsAll(permissions);
				this.hasPermission = data.hasPermission;
			} else {
				const data = await checkPermissionsSome(permissions);
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
			this.style.display = 'none';
			return html``;
		}

		if(!this.hasPermission) {
			this.style.display = 'none';
			return html``;
		}

		this.style.display = '';
		return html`<slot></slot>`;
	}
}

window.customElements.define('k-permission', Permission);
