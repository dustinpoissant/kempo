import { LitElement, html, css } from '/kempo-ui/lit-all.min.js';
import { currentUserHasPermission, currentUserHasAllPermissions, currentUserHasSomePermissions } from '../sdk.js';

/*
  A wrapper only: it draws no box of its own (`display: contents`), so what is inside lines up as if it were not there.
  What is inside is slotted, so it is shown only to people who have the permission.
*/
export default class Permission extends LitElement {
	static styles = css`:host{display:contents}`;

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

	render() {
		if(this.loading || !this.hasPermission) return html``;
		return html`<slot></slot>`;
	}
}

window.customElements.define('k-permission', Permission);
