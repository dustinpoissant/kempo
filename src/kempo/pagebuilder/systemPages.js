/*
  The pages that come with kempo (the ones in app-public), as the widgets they are made of. The page file is what is served,
  and a file the builder did not write opens in the builder as one HTML widget, so each of these pages would open as a
  single block of code. With the tree here, a page whose file still holds what its tree renders to opens as these widgets
  instead, ready to be changed, on the first open (see openPage.js). A page someone has already changed no longer matches,
  so their copy is never replaced.

  scripts/build-system-pages.js writes the page files in app-public from these trees, so the two always agree; a test keeps
  them honest. Like serverWidgets.js this imports nothing. A tree is { location: [widget nodes] }, a node is
  { id, type, attrs, slots }, and the ids are only names for this module, so they can be anything unique within a page.
*/

const node = (id, type, attrs = {}, slots = {}) => ({ id, type, attrs, slots });
const column = (id, attrs, children = []) => node(id, 'column', attrs, { default: children });
const text = (id, html, styles) => node(id, 'text', styles ? { html, styles } : { html });
const location = (id, name, label) => node(id, 'location', { name, label });
const button = (id, attrs) => node(id, 'button', { kind: 'link', ...attrs });

/*
  The room under and to the right of each button on the account page. Every button there, and the links other extensions put
  in its account-links place, carries the same margin classes (`mb mrq`), since a button with a margin below it sits higher
  on the line than one without.
*/
const spaced = { margin: { top: '', left: '', right: 'q', bottom: 'f' } };

/* A column in the middle of the page, with room either side on a wide screen, as the login page is laid out. */
const centered = (name, children) => node(`${name}-row`, 'columns', {}, {
  default: [
    column(`${name}-left`, { mobile: '', tablet: '1', desktop: '3' }),
    column(`${name}-middle`, { mobile: '12', desktop: '6' }, children),
    column(`${name}-right`, { mobile: '12', tablet: '1', desktop: '3' }),
  ],
});

/* A label and a value side by side (stacked on a phone), for the account page. */
const detail = (name, label, widget) => node(`${name}-row`, 'columns', {}, {
  default: [
    column(`${name}-label`, { mobile: '12', tablet: '4', desktop: '4' }, [text(`${name}-text`, `<strong>${label}</strong>`)]),
    column(`${name}-value`, { mobile: '12', tablet: '8', desktop: '8' }, [widget]),
  ],
});

export default {
  'index.page.html': {
    default: [
      text('home-welcome', '<h1>Welcome to Kempo</h1><p>Your site is up and running. Head to the <a href="/admin">admin panel</a> to manage your site.</p>'),
    ],
  },

  'CATCH.page.html': {
    default: [
      text('missing-text', '<h1>404</h1><p>Page not found</p>', { align: 'center' }),
      node('missing-actions', 'group', { styles: { align: 'center' } }, { default: [button('missing-home', { label: 'Go back home', href: '/' })] }),
    ],
  },

  'login/index.page.html': {
    default: [
      centered('login', [
        node('login-form', 'login', { redirect: '/account' }, { default: [location('login-after', 'login-form-after', 'After the Login Form')] }),
      ]),
    ],
  },

  'register/index.page.html': {
    default: [
      centered('register', [
        node('register-form', 'register', { redirect: '/account', 'verify-redirect': '/verify-email' }, { default: [location('register-after', 'register-form-after', 'After the Register Form')] }),
      ]),
    ],
  },

  'forgot-password/index.page.html': {
    default: [centered('forgot', [node('forgot-form', 'forgot-password')])],
  },

  'reset-password/[token]/index.page.html': {
    default: [centered('reset', [node('reset-form', 'reset-password')])],
  },

  'verify-email/index.page.html': {
    default: [
      centered('verify-sent', [
        text('verify-sent-text', '<h2>Check Your Email</h2><p>We\'ve sent a verification link to your email address. Please check your inbox and click the link to verify your account.</p><p>Didn\'t receive the email? Check your spam folder or contact support.</p>', { align: 'center' }),
      ]),
    ],
  },

  'verify-email/[token]/index.page.html': {
    default: [centered('verify', [node('verify-form', 'verify-email')])],
  },

  'delete-account/index.page.html': {
    default: [centered('delete', [node('delete-form', 'delete-account')])],
  },

  'account/index.page.html': {
    default: [
      centered('account', [
        text('account-title', '<h2>My Account</h2>'),
        detail('account-name', 'Name:', node('account-name', 'user-name')),
        detail('account-email', 'Email:', node('account-email', 'user-email')),
        detail('account-verified', 'Email Verified:', node('account-verified', 'user-email-verified')),
        detail('account-since', 'Member Since:', node('account-since', 'user-created-at')),
        location('account-details', 'account-details', 'After the Account Details'),
        node('account-admin', 'permission', { has: 'system:admin:access' }, { default: [button('account-admin-link', { label: 'Admin Panel', href: '/admin', color: 'primary', styles: spaced })] }),
        location('account-links', 'account-links', 'Account Links'),
        node('account-password', 'change-password', { styles: spaced }),
        node('account-logout', 'logout', { label: 'Logout', redirect: '/login', color: 'danger', styles: spaced }),
        button('account-delete', { label: 'Delete my account', href: '/delete-account/', color: 'danger', styles: spaced }),
      ]),
    ],
  },
};
