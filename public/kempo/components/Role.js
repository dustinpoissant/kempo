import LightComponent from 'https://cdn.jsdelivr.net/npm/kempo-ui@0.0.42/dist/components/LightComponent.js';
import { html } from 'https://cdn.jsdelivr.net/npm/lit@3.2.1/+esm';
import { getActiveMemberRole } from '../auth.js';

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
		const roleHierarchy = ['subscriber', 'contributor', 'editor', 'admin', 'superAdmin'];

		try {
			const { role } = await getActiveMemberRole();
			const userRoleIndex = roleHierarchy.indexOf(role);

			if(userRoleIndex === -1) {
				this.hasRole = false;
				this.loading = false;
				return;
			}

			if(this.exclude) {
				const excludedRoles = this.exclude.split(',').map(r => r.trim());
				if(excludedRoles.includes(role)) {
					this.hasRole = false;
					this.loading = false;
					return;
				}
			}

			if(!this.requires) {
				this.hasRole = true;
				this.loading = false;
				return;
			}

			const requiredRoles = this.requires.split(',').map(r => r.trim());
			
			this.hasRole = requiredRoles.some(requiredRole => {
				const requiredIndex = roleHierarchy.indexOf(requiredRole);
				return requiredIndex !== -1 && userRoleIndex >= requiredIndex;
			});
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
