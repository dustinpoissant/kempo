/*
  The widgets for kempo's own functions: signing in and out, registering, the password forms, deleting an account, who
  someone is, what they may see, and their notifications. Each is a kempo element that the pages that come with kempo are
  made of, so those pages can be changed in the page builder and the same pieces can go anywhere else.

  A widget definition for kempo-ui's page builder (see kempo-ui's `PageBuilder.addWidget`). Like serverWidgets.js this
  imports nothing, so the server and the admin register the same list, each with its own `addWidget`. The elements are
  served from /kempo/components, and the builder's copies (which never sign anyone in or out, or send a form) from
  CoreWidgetEditors.js.
*/

const components = '/kempo/components';
const editors = '/admin/components/pagebuilder/CoreWidgetEditors.js';
const account = { category: 'account', categoryTitle: 'Account' };
const server = { category: 'server', categoryTitle: 'Server' };
const inline = { inline: true };

/* Widgets that hold a button sit on the line the way a button does (the middle), so they line up with plain links styled as buttons. */
const buttonLike = { inline: true, style: () => 'vertical-align: middle' };

const COLORS = ['primary', 'secondary', 'success', 'warning', 'danger'];
const COLOR_OPTIONS = [{ value: '', label: 'Default' }, ...COLORS.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))];

/*
  A button that does its job through a script on the page: a plain kempo-css button (a link while it is being edited, so it
  does nothing there), with nothing around it, so the Styles tab's margin and alignment classes go on the button itself like
  they do on any other button.
*/
const plainButton = (marker, fallback) => (node, ctx, info) => {
  const attrs = node.attrs || {};
  return ctx.standard(node, info, {
    tag: ctx.editor ? 'a' : 'button',
    classes: ['btn', COLORS.includes(attrs.color) ? attrs.color : ''],
    extra: ctx.editor ? '' : ` type="button" ${marker}`,
    content: ctx.escapeText(attrs.label || fallback)
  });
};

export default [
  {
    name: 'login',
    title: 'Login form',
    description: 'The sign-in form. What is placed inside it shows under the form, for other ways in.',
    icon: 'person',
    ...account,
    keywords: ['sign in', 'log in', 'login', 'password', 'account'],
    tag: 'k-login',
    page: `${components}/Login.js`,
    editor: editors,
    editorTag: 'k-login-editor',
    attributes: [{ name: 'redirect', type: 'url', label: 'After signing in', hint: 'Where to go once signed in. A ?next= address in the page\'s own address wins.', default: '/account' }],
    slots: [{ name: 'default', label: 'Under the form' }]
  },
  {
    name: 'register',
    title: 'Register form',
    description: 'The form that makes a new account. What is placed inside it shows under the form.',
    icon: 'person_add',
    ...account,
    keywords: ['sign up', 'register', 'create account', 'join', 'account'],
    tag: 'k-register',
    page: `${components}/Register.js`,
    editor: editors,
    editorTag: 'k-register-editor',
    attributes: [
      { name: 'redirect', type: 'url', label: 'After registering', hint: 'Where to go once the account is made, when it needs no email check.', default: '/account' },
      { name: 'verify-redirect', type: 'url', label: 'When the email must be checked', hint: 'Where to go when the person has to verify their email before signing in.', default: '/verify-email' }
    ],
    slots: [{ name: 'default', label: 'Under the form' }]
  },
  {
    name: 'forgot-password',
    title: 'Forgot password form',
    description: 'Asks for an email address and sends the link that resets the password.',
    icon: 'lock',
    ...account,
    keywords: ['forgot', 'reset', 'password', 'recover', 'account'],
    tag: 'k-forgot-password',
    page: `${components}/ForgotPassword.js`,
    editor: editors,
    editorTag: 'k-forgot-password-editor',
    attributes: [{ name: 'login-href', type: 'url', label: 'Login page', hint: 'Where "Login" goes.', default: '/login' }]
  },
  {
    name: 'reset-password',
    title: 'Reset password form',
    description: 'The new password form the emailed link opens. Put it on the page at /reset-password/<token>.',
    icon: 'lock_add',
    ...account,
    keywords: ['reset', 'new password', 'password', 'account'],
    tag: 'k-reset-password',
    page: `${components}/ResetPassword.js`,
    editor: editors,
    editorTag: 'k-reset-password-editor',
    attributes: [{ name: 'redirect', type: 'url', label: 'After resetting', hint: 'Where to go once the password is changed.', default: '/account' }]
  },
  {
    name: 'change-password',
    title: 'Change password button',
    description: 'A button that opens a form to change the password of the signed-in person.',
    icon: 'lock_add',
    ...account,
    keywords: ['change', 'password', 'account', 'security'],
    tag: 'button',
    page: `${components}/ChangePasswordButton.js`,
    inline: true,
    attributes: [
      { name: 'label', type: 'string', virtual: true, label: 'Button text', default: 'Change Password' },
      { name: 'color', type: 'select', virtual: true, label: 'Color', default: '', options: COLOR_OPTIONS }
    ],
    render: plainButton('data-change-password', 'Change Password')
  },
  {
    name: 'verify-email',
    title: 'Verify email',
    description: 'Verifies an email address from the emailed link, and says how it went. Put it on the page at /verify-email/<token>.',
    icon: 'verified',
    ...account,
    keywords: ['verify', 'email', 'confirm', 'account'],
    tag: 'k-verify-email',
    page: `${components}/VerifyEmail.js`,
    editor: editors,
    editorTag: 'k-verify-email-editor',
    attributes: [
      { name: 'redirect', type: 'url', label: 'After verifying', hint: 'Where to go once the email is verified.', default: '/account' },
      { name: 'login-href', type: 'url', label: 'Login page', hint: 'Where "Go to Login" goes.', default: '/login' }
    ]
  },
  {
    name: 'delete-account',
    title: 'Delete account form',
    description: 'Deletes an account and what the site keeps about the person, once a code sent to their email comes back.',
    icon: 'manage-accounts',
    ...account,
    keywords: ['delete', 'remove', 'close', 'account', 'privacy', 'gdpr'],
    tag: 'k-delete-account',
    page: `${components}/DeleteAccount.js`,
    editor: editors,
    editorTag: 'k-delete-account-editor',
    attributes: [{ name: 'home-href', type: 'url', label: 'Home page', hint: 'Where "Back to the home page" goes.', default: '/' }]
  },
  {
    name: 'logout',
    title: 'Logout button',
    description: 'Signs the person out.',
    icon: 'person',
    ...account,
    keywords: ['sign out', 'log out', 'logout', 'account'],
    tag: 'button',
    page: `${components}/LogoutButton.js`,
    inline: true,
    attributes: [
      { name: 'label', type: 'string', virtual: true, label: 'Button text', default: 'Logout' },
      { name: 'redirect', attr: 'data-redirect', type: 'url', label: 'After signing out', hint: 'Where to go. Leave it empty to stay on the page.', default: '' },
      { name: 'color', type: 'select', virtual: true, label: 'Color', default: '', options: COLOR_OPTIONS }
    ],
    render: plainButton('data-logout', 'Logout')
  },
  {
    name: 'user-name',
    title: 'Signed-in name',
    description: 'The name of the person who is signed in.',
    icon: 'person',
    ...account,
    ...inline,
    keywords: ['name', 'user', 'profile', 'account'],
    tag: 'k-user-name',
    page: `${components}/UserName.js`,
    attributes: []
  },
  {
    name: 'user-email',
    title: 'Signed-in email',
    description: 'The email address of the person who is signed in.',
    icon: 'mail',
    ...account,
    ...inline,
    keywords: ['email', 'user', 'profile', 'account'],
    tag: 'k-user-email',
    page: `${components}/UserEmail.js`,
    attributes: []
  },
  {
    name: 'user-email-verified',
    title: 'Signed-in email verified',
    description: 'Whether the signed-in person\'s email address has been verified.',
    icon: 'verified',
    ...account,
    ...inline,
    keywords: ['verified', 'email', 'user', 'account'],
    tag: 'k-user-email-verified',
    page: `${components}/UserEmailVerified.js`,
    attributes: []
  },
  {
    name: 'user-created-at',
    title: 'Signed-in member since',
    description: 'When the signed-in person\'s account was made.',
    icon: 'account-circle',
    ...account,
    ...inline,
    keywords: ['member since', 'joined', 'created', 'user', 'account'],
    tag: 'k-user-created-at',
    page: `${components}/UserCreatedAt.js`,
    attributes: []
  },
  {
    name: 'notification-bell',
    title: 'Notification bell',
    description: 'A bell with the number of unread notifications that opens the latest ones. Shows nothing when nobody is signed in.',
    icon: 'notifications',
    ...account,
    ...buttonLike,
    keywords: ['notifications', 'alerts', 'bell', 'unread'],
    tag: 'k-notification-bell',
    page: `${components}/NotificationBell.js`,
    attributes: [
      { name: 'page-href', type: 'url', label: 'View all link', hint: 'A page with every notification. Leave it empty for no link.', default: '' },
      { name: 'interval', type: 'number', label: 'Check every (milliseconds)', hint: '0 turns the background checks off.', default: 60000, min: 0 },
      { name: 'open-direction', type: 'string', label: 'Opens toward', hint: 'Where the list opens from the bell, such as down right or down left.', default: 'down right' },
      { name: 'button-class', type: 'string', label: 'Button classes', hint: 'Extra classes for the bell\'s button.', default: '' }
    ]
  },
  {
    name: 'notification-list',
    title: 'Notification list',
    description: 'The signed-in person\'s notifications.',
    icon: 'notifications',
    ...account,
    keywords: ['notifications', 'alerts', 'inbox', 'unread'],
    tag: 'k-notification-list',
    page: `${components}/NotificationList.js`,
    attributes: [
      { name: 'unread-only', type: 'boolean', label: 'Only unread', default: false },
      { name: 'page-size', type: 'number', label: 'Notifications per page', default: 20, min: 1, max: 100 },
      { name: 'paginated', type: 'boolean', label: 'Pages', hint: 'Show page buttons instead of a Show more button.', default: false },
      { name: 'compact', type: 'boolean', label: 'Compact', default: false }
    ]
  },
  {
    name: 'permission',
    title: 'Show for permission',
    description: 'Shows what is inside it only to people who have a permission.',
    icon: 'visibility',
    ...server,
    keywords: ['permission', 'access', 'admin', 'hide', 'show', 'signed in'],
    tag: 'k-permission',
    page: `${components}/Permission.js`,
    editor: editors,
    editorTag: 'k-permission-editor',
    display: '',
    attributes: [
      { name: 'has', type: 'string', label: 'Has the permission', hint: 'One permission, such as system:admin:access.', default: '' },
      { name: 'all', type: 'string', label: 'Has all of', hint: 'Permissions separated by commas. Use one of these three settings.', default: '' },
      { name: 'some', type: 'string', label: 'Has any of', hint: 'Permissions separated by commas.', default: '' }
    ],
    slots: [{ name: 'default', label: 'Shown to them' }]
  }
];
