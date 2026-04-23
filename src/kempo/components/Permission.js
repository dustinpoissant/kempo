import LightComponent from '/kempo-ui/components/LightComponent.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { currentUserHasPermission, currentUserHasAllPermissions, currentUserHasSomePermissions } from '../sdk.js';

export default class Permission extends LightComponent {
	static properties = {
		has: { type: String },
		all: { type: String },
		some: { type: String },
		loading: { type: Boolean, state: true },
		hasPermission: { type: Boolean, state: true }
	};

	constructor() {
		super();
		this.has = '';
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
		const attributeCount = [this.has, this.all, this.some].filter(Boolean).length;
		
		if(attributeCount > 1) {
			this.hasPermission = false;
			this.loading = false;
			return;
		}

		if(attributeCount === 0) {
			this.hasPermission = true;
			this.loading = false;
			return;
		}

		try {
			if(this.has) {
				const [error, data] = await currentUserHasPermission({ permission: this.has });
				this.hasPermission = error ? false : data.hasPermission;
			} else if(this.all) {
				const permissions = this.all.split(',').map(p => p.trim());
				const [error, data] = await currentUserHasAllPermissions({ permissions });
				this.hasPermission = error ? false : data.hasPermission;
			} else {
				const permissions = this.some.split(',').map(p => p.trim());
				const [error, data] = await currentUserHasSomePermissions({ permissions });
				this.hasPermission = error ? false : data.hasPermission;
			}
		} catch(error) {
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
