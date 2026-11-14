import getPermissionsForGroups from './getPermissionsForGroups.js';
import { GUESTS_GROUP } from '../setup/systemGroups.js';

/*
  The permissions every guest has: those of the system:Guests group. A guest is a session, not a person, so they all hold the
  same ones. Whether the visitor really is a guest is the HTTP layer's to decide (`request.guest`); this only says what a guest may do.
  A site where the group is missing has no guest permissions. A `restricted` guest (`request.restricted`) has none at all.
*/
export default async ({ restricted = false } = {}) => restricted
  ? [null, []]
  : getPermissionsForGroups([{ name: GUESTS_GROUP }]);
