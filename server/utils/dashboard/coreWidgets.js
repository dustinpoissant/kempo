import { CORE_OWNER } from './helpers.js';

const core = widget => ({
  owner: CORE_OWNER,
  description: null,
  icon: null,
  iconSrc: null,
  defaultWidth: 2,
  defaultHeight: 1,
  minWidth: 1,
  maxWidth: 4,
  minHeight: 1,
  maxHeight: 3,
  permission: null,
  actions: [],
  defaultVisible: true,
  ...widget,
  id: `${CORE_OWNER}:${widget.key}`
});

/*
  The widgets Kempo itself puts on the dashboard. They are code, not rows, so an existing site gets
  them on upgrade with nothing to seed, and `priority` leaves room for extensions on either side.
*/
export default [
  core({
    key: 'pages',
    title: 'Pages',
    description: 'How many pages the site has and which changed most recently.',
    icon: 'docs',
    element: 'k-widget-pages',
    module: '/admin/components/widgets/Pages.js',
    defaultWidth: 2,
    defaultHeight: 2,
    minWidth: 2,
    minHeight: 2,
    permission: 'system:pages:read',
    priority: 10
  }),
  core({
    key: 'content',
    title: 'Content',
    description: 'Templates, fragments and global content at a glance.',
    icon: 'content',
    element: 'k-widget-content',
    module: '/admin/components/widgets/Content.js',
    defaultWidth: 1,
    defaultHeight: 1,
    permission: 'system:pages:read',
    priority: 20
  }),
  core({
    key: 'users',
    title: 'Users',
    description: 'How many people have an account.',
    icon: 'person',
    element: 'k-widget-users',
    module: '/admin/components/widgets/Users.js',
    defaultWidth: 1,
    defaultHeight: 1,
    permission: 'system:user:read',
    priority: 30
  }),
  core({
    key: 'notifications',
    title: 'Notifications',
    description: 'Your unread notifications.',
    icon: 'notifications',
    element: 'k-widget-notifications',
    module: '/admin/components/widgets/Notifications.js',
    defaultWidth: 2,
    defaultHeight: 2,
    minWidth: 2,
    priority: 40
  }),
  core({
    key: 'extensions',
    title: 'Extensions',
    description: 'Installed extensions and whether they are enabled.',
    icon: 'extension',
    element: 'k-widget-extensions',
    module: '/admin/components/widgets/Extensions.js',
    defaultWidth: 1,
    defaultHeight: 1,
    permission: 'system:extensions:read',
    priority: 50
  })
];
