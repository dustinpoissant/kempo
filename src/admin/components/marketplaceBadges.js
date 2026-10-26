/*
  The marks an approver puts on a listed extension: official (the marketplace's own endorsement) and featured
  (a third party's extension the approvers think is high quality). Each is an icon in success green, before the name.
*/
const badge = (name, label) => {
  const icon = document.createElement('k-icon');
  icon.setAttribute('name', name);
  icon.setAttribute('title', label);
  icon.setAttribute('aria-label', label);
  icon.className = 'tc-success mr';
  return icon;
};

export default item => [
  item.official && badge('verified', 'Official'),
  item.featured && badge('workspace_premium', 'Featured'),
].filter(Boolean);
