# Contributing Guidelines

## Architecture: Four-Layer Separation

This project maintains strict boundaries between the frontend, HTTP layer, business logic, and database. This separation provides security, flexibility, and maintainability that modern "full-stack" frameworks sacrifice for convenience.

### Philosophy: Clear Separation of Concerns

"Server components" and "server functions" that can be called from the frontend create attack surfaces. This project keeps clear, explicit boundaries.

### Four-Layer Architecture

```
┌─────────────────────────────────────┐
│   Frontend (public/)                │  ← HTML, CSS, client-side JS
│   - Only communicates via fetch()   │
│   - Never imports from server/      │
└─────────────────────────────────────┘
            ↓ HTTP requests only
┌─────────────────────────────────────┐
│   HTTP Layer (public/*/GET.js, etc) │  ← Route handlers
│   - Extracts data from req/res      │
│   - Calls backend utils             │
│   - Formats HTTP responses          │
└─────────────────────────────────────┘
            ↓ Function calls only
┌─────────────────────────────────────┐
│   Backend Logic (server/utils/)     │  ← Pure business logic
│   - Zero HTTP dependencies          │
│   - Accepts pure data (IDs, tokens) │
│   - Returns pure data or errors     │
└─────────────────────────────────────┘
            ↓ SQL only
┌─────────────────────────────────────┐
│   Database (Postgres via Drizzle)   │  ← Data persistence
└─────────────────────────────────────┘
```

### Layer Rules

#### Frontend Layer (`public/`)
**Can:**
- HTML, CSS, client-side JavaScript
- Import client-side libraries (Lit, etc.)
- Make fetch() requests to API endpoints

**Cannot:**
- Import from `server/` or `middleware/`
- Access database directly
- Access environment variables or secrets
- Execute server-side code

#### HTTP Layer (`src/kempo/api/**/[METHOD].js`, `middleware/`)
**Can:**
- Access `request.headers`, `request.cookies`, `request.body`
- Extract authentication tokens from cookies or Authorization headers
- Call backend utils with extracted data
- Set HTTP status codes and headers
- Format responses as JSON/HTML

**Cannot:**
- Contain business logic (delegate to `server/utils/`)
- Access database directly (call utils instead)

#### Backend Logic (`server/utils/`)
**Can:**
- Accept pure JavaScript data types (strings, numbers, objects)
- Call database functions
- Import other utils
- Return data or throw errors

**Cannot:**
- Access `request` or `response` objects
- Read cookies or headers
- Set HTTP status codes or headers
- Import anything from `public/` or `middleware/`

#### Database Layer (`server/db/`)
**Can:**
- Define schema
- Manage migrations
- Provide database connection

**Cannot:**
- Contain business logic
- Access HTTP layer

### Why This Separation?

**Security**
- No confusion about what code runs where
- HTTP layer validates and sanitizes all input before passing to backend
- Backend utils can't accidentally leak HTTP headers or cookies
- Clear audit trail: every backend call originates from an explicit HTTP endpoint

**Flexibility**
Multiple frontends can use the same backend:
- Web app (cookie-based auth)
- Mobile app (Bearer token auth)
- CLI tool (API key auth)
- Third-party integrations (OAuth)

Just create different HTTP layers - the backend stays the same.

**Maintainability**
- Backend utils are pure functions - easy to test without mocking HTTP
- Change authentication method? Update middleware, utils stay the same
- Swap frontend framework? Backend unaffected
- No magic - explicit boundaries make debugging straightforward

**No Build Complexity**
- Frontend uses native ES modules (Lit)
- No transpilation during development
- What you write is what runs
- Source maps not needed - debug actual code

### Example: Login Flow

**Frontend** (`public/login/index.html`):
```javascript
const response = await fetch('/kempo/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
```

**HTTP Layer** (`src/kempo/api/auth/login/POST.js`):
```javascript
import loginEmail from '../../../../../server/utils/auth/loginEmail.js';

export default async (request, response) => {
  const { email, password } = await request.json();
  const [error, result] = await loginEmail({ email, password });
  
  if(error){
    return response.status(error.code).json({ error: error.msg });
  }
  
  response.setHeader('Set-Cookie', `session_token=${result.sessionToken}; HttpOnly; Secure`);
  response.json({ user: result.user });
};
```

**Backend Logic** (`server/utils/auth/loginEmail.js`):
```javascript
export default async ({ email, password }) => {
  // Validate credentials, create session
  // Returns [null, { user, sessionToken }] or [{ code, msg }, null]
};
```

Notice:
- Frontend only knows about HTTP
- HTTP layer extracts data, calls utils, handles cookies
- Backend util is pure: takes email/password, returns data

### Supporting Mobile Apps

Create a separate HTTP layer for mobile with Bearer tokens:

**mobile-api/auth/login/POST.js**:
```javascript
import loginEmail from '../../server/utils/auth/loginEmail.js';

export default async (request, response) => {
  const { email, password } = await request.json();
  const [error, result] = await loginEmail({ email, password });
  
  // Return token in body instead of cookie
  response.json({
    user: result.user,
    token: result.sessionToken
  });
};
```

**mobile-api/user/profile/GET.js**:
```javascript
import getSession from '../../server/utils/auth/getSession.js';

export default async (request, response) => {
  const token = request.headers.authorization?.slice(7); // "Bearer <token>"
  const [error, session] = await getSession({ token });
  response.json({ user: session.user });
};
```

Same backend utils, different HTTP layer.

### Testing

Backend utils are pure functions - test them directly:

```javascript
import loginEmail from '../server/utils/auth/loginEmail.js';

test('login with valid credentials', async () => {
  const [error, result] = await loginEmail({
    email: 'test@example.com',
    password: 'password123'
  });
  
  assert(!error);
  assert(result.user);
  assert(result.sessionToken);
});
```

No need to mock HTTP, cookies, or headers.

### This is Old-School (And That's Good)

Modern frameworks try to be too clever. They hide the boundary between client and server, leading to:
- Accidental data leaks (server code in client bundles)
- Confused authentication (what runs where?)
- Security vulnerabilities (exposed server functions)

This project is deliberately "boring":
- Explicit HTTP boundaries
- Clear file structure
- No magic
- Easy to understand and audit

Choose simplicity over cleverness.

## Error Handling Pattern

This project uses the **structured error tuple pattern** for all backend utilities. Functions return a tuple (array) where the first element indicates success or failure, and the second element contains the result data.

### Pattern Structure

```javascript
// Success: [null, resultData]
return [null, { user, sessionToken }];

// Failure: [{ code, msg }, null]
return [{ code: 404, msg: 'User not found' }, null];
```

### Rules

1. **Always return a tuple** with exactly 2 elements
2. **First element**: 
   - `null` on success
   - `{ code, msg }` object on failure
3. **Second element**:
   - Result data on success
   - `null` on failure
4. **Error codes** should be HTTP-compatible (400, 404, 500, etc.)
5. **Error messages** should be human-readable and safe to display to users

### Usage Example

**Backend util** (`server/utils/users/getUser.js`):
```javascript
import db from '../../db/index.js';
import { user } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export default async ({ userId }) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  const foundUser = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if(!foundUser.length){
    return [{ code: 404, msg: 'User not found' }, null];
  }

  return [null, foundUser[0]];
};
```

**HTTP layer** (`src/kempo/api/user/GET.js`):
```javascript
import getUser from '../../../../server/utils/users/getUser.js';

export default async (request, response) => {
  const userId = request.query.id;
  const [error, user] = await getUser({ userId });
  
  if(error){
    return response.status(error.code).json({ error: error.msg });
  }
  
  response.json({ user });
};
```

### Benefits

- **Explicit error handling**: Can't ignore errors (destructure both values)
- **No try/catch needed**: Errors are values, not exceptions
- **Consistent pattern**: All utils follow the same convention
- **HTTP-ready**: Error codes map directly to HTTP status codes
- **Testable**: Easy to test both success and failure cases

### Common Error Codes

- `400` - Bad request (validation errors, missing required fields)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (authenticated but not authorized)
- `404` - Not found (resource doesn't exist)
- `409` - Conflict (duplicate email, username taken, etc.)
- `500` - Internal server error (database errors, unexpected failures)

### Multiple Errors

If validation produces multiple errors, return an array of error objects:

```javascript
return [{
  code: 400,
  msg: 'Validation failed',
  errors: [
    { field: 'email', msg: 'Invalid email format' },
    { field: 'password', msg: 'Password too short' }
  ]
}, null];
```

## Coding Style Guidelines

### Code Organization
Use multi-line comments to separate code into logical sections. Group related functionality together.

```javascript
/*
  Section Name
*/
```

### Variable and Function Usage
Avoid defining a variable or function to only use it once; inline the logic where needed. Exceptions include:
- Recursion
- Scope encapsulation (IIFE)
- Context changes

### Comments and Spacing

**Use minimal comments.** Assume readers understand the language. Comment only for:
- Complex logic
- Anti-patterns
- Code organization sections

**Empty lines** should be used intentionally:
- Above and below function/class definitions
- To break up large sections of logic
- Above multi-line comments

**No empty lines in CSS.**

**End each file with an empty line.**

**End each line with a `;` when possible**, even if optional.

**Avoid unnecessary spacing:**
```javascript
// Good
if(condition){
  doSomething();
}

// Bad
if ( condition ) {
  doSomething();
}
```

### Arrow Functions
Prefer arrow functions when possible, especially for class methods to avoid binding issues. Use regular functions only when you need to preserve context.

```javascript
// Good - implicit return, no parens for single param
const addOne = n => n + 1;

// Good - explicit return for complex logic
const calculate = (a, b) => {
  const result = a * b;
  return result + 1;
};
```

### Module Exports
- **Single export**: Use default export without naming it
  ```javascript
  export default (n) => n + 1;
  ```
- **Multiple exports**: Use named exports, no default
  ```javascript
  export const add = (a, b) => a + b;
  export const subtract = (a, b) => a - b;
  ```

### Naming Conventions
**Never use leading underscores** for any identifiers. Use clear, descriptive names without prefixes.

```javascript
// Good
class User {
  #privateField;  // Use native private fields
  publicField;
}

// Bad
class User {
  _privateField;  // Don't simulate privacy with underscores
}
```

### Utility Functions
Create utility functions for shared logic:
- If used in a single file: define it in that file
- If used across multiple files: create a module in `server/utils/` (backend) or the appropriate location (frontend)


## Web Components: Compose, Don't Inject

How components and extensions fit together. The full guide, with examples from the products extensions, is in
[docs/extensions/creating-extensions.md](docs/extensions/creating-extensions.md#designing-for-other-extensions-slots-templates-and-locations).

### The principle

**Say where things may go, and let others put things only there.** A component declares *slots*. A page
declares *locations*. Extensions contribute into those places with plain markup. Nobody finds a spot in
somebody else's DOM and puts something in it from JavaScript.

Imperative injection (`appendChild`, `innerHTML`, `insertAdjacentElement`, `createElement` into a
component that renders itself) is fragile and does not scale: Lit re-renders and the added node is gone,
two extensions fight over one spot, and nothing says what is allowed where. Composition has rules, so it
holds up as more extensions are added.

### Rules

- **Use slots.** A component exposes named `<slot>`s for what others may add. Content goes in as light DOM
  children. Never reach into another component's shadow root, and do not append to your own component's DOM
  from its own script.
- **Composition over inheritance.** Build bigger things by placing components inside components. Extend a
  class only to make a *variation* of a component, never to add a feature (a feature is another component
  in a slot).
- **A repeated thing uses one `<template>`.** Many buttons, badges or panels on every item of a list means one
  `<template>` on the page, cloned by the component that repeats the items into each item as slotted children
  (`document.importNode(template.content, true)`), once per item and kept (a `WeakMap`), so a re-render does
  not rebuild it. The item itself does not know about templates.
- **Use `closest()` freely to find your context.** A component placed in a slot finds the exact parent it is
  inside of with `this.closest('parent-tag')` and reads its contract. This is why slots beat injecting into a
  shadow root: `closest()` stops at a shadow root, but it finds a slotted child's parent.
- **Give a parent a small public contract.** An attribute naming what it is for (`product-id`), properties for
  data it already has (`product`, so children do not fetch it again), methods that cause actions, and bubbling,
  composed events that report that something happened.
- **Locations are the insertion points.** Pages, templates and fragments declare `<location name="…" />` and
  extensions fill them with `*.global.html`. Prefix names with the owner (`products-card-actions`), document
  them as public API, and put each component's `<script type="module">` in a scripts location outside any
  `<template>`.
- **A contribution names its own slot, and there is no wrapper.** Put the location directly among the
  component's children and give the contributed element `slot="actions"`. A slot takes any number of elements,
  and a wrapper `<div slot="…">` would always occupy the slot and hide its default content.
- **Lay out the slot in the component, not in the contribution.** To put the slotted elements in a row or give
  them a gap, wrap the `<slot>` in an element in the component's own shadow DOM and style that wrapper. The
  styles live with the component, and contributors never have to wrap anything.
- **A default that an extension might replace is the slot's default content.** `<slot name="price">…the normal
  price…</slot>` shows the normal price until an extension puts `<k-sales-price slot="price">` in the slot, and
  the component never changes. The default must be real, working content. Use this for something to be
  *replaced* (one owner); leave a slot that holds *several* things (actions) with no default.
- **Extensions can declare locations too**, giving other extensions places to add. A location stacks every
  contribution by `priority`; a `<fragment>` has one winner, so use a fragment for one replaceable block.
- **Logic belongs in the component.** The contributed component fetches and renders its own data when it is
  upgraded. Do not write a script that hunts the DOM for places to put things.

### Worked example

kempo-products puts one `<template>` on its list page and a location in its product page. kempo-commerce
fills them; neither edits the other.

```html
<!-- kempo-products: the page -->
<fragment name="products-card-template" />          <!-- the one template, with locations in it -->
<k-products-list></k-products-list>

<k-products-detail>
  <location name="products-detail-price" />
  <location name="products-detail-actions" />
</k-products-detail>

<!-- kempo-commerce: public/product-actions.global.html -->
<content location="products-scripts"><script type="module" src="/commerce/components/AddToCart.js"></script></content>
<content location="products-card-actions"><k-commerce-add-to-cart slot="actions"></k-commerce-add-to-cart></content>
<content location="products-detail-actions"><k-commerce-add-to-cart slot="actions"></k-commerce-add-to-cart></content>

<!-- a sale extension replaces the price, which is the slot's default content -->
<content location="products-card-price"><k-sales-price slot="price"></k-sales-price></content>
```

```javascript
// k-commerce-add-to-cart finds which card or product page it is in, and follows it
this.host = this.closest('k-products-card, k-products-detail');
this.product = this.host.product;
```

### Server templating pitfalls

The server resolves `{{ }}`, `<if>`, `<foreach>`, `<fragment>` and `<location>` across a page's whole text,
including inside a `<template>` and inside HTML comments. So: no `{{name}}` placeholders for an item's data
(the component renders that), and never write a literal `<fragment …>` or `<location …>` tag in a comment.

## Email templates use kempo-css

An email (or anything else drawn with `renderEmailTemplate`, such as a packing slip) is an HTML template, and kempo styles it with
kempo-css automatically. `renderEmailTemplate` renders the template, then calls `shake` from `kempo-css/shake` on the result:
only the kempo-css rules for the tags, classes and ids the HTML actually uses are kept, every `var()` and `light-dark()` is
replaced by its value from the site's theme (`public/styles.css`, light mode), and the CSS is embedded in the `<head>`. Mail
clients cannot load a stylesheet or resolve CSS variables, which is why this is done for you.

So write the template the way you would write a page:

```html
<page template="email" title="A note about your order">
<content>
<h2>A note about your order</h2>
<blockquote>{{note}}</blockquote>
<table class="mb">
<tr><th>Item</th><th class="ta-right">Total</th></tr>
<foreach in="lines" as="line">
<tr><td>{{line.name}} &times; {{line.quantity}}</td><td class="ta-right">{{line.total}}</td></tr>
</foreach>
</table>
<p class="ta-center"><a class="btn primary" href="{{orderLink}}">View your order</a></p>
</content>
</page>
```

 - Use native elements and kempo-css classes. No `style` attributes and no `<style>` blocks (the same rule as everywhere else).
 - Keep to what mail clients handle: tables and text, no flex or grid, no scripts, no `<k-*>` components.
 - The shaken CSS is exactly what kempo-css has for the classes used, so check the result in the mail clients that matter before relying on a newer CSS feature.
 - `{{var}}` is inserted as it is: escape everything that came from a customer or from staff before it reaches a template.
 - An extension ships its templates in `emails/` (`<page template="email">`); a site overrides one at `templates/emails/<extension>/<name>.page.html`, and can replace the layout with `templates/emails/email.template.html`.
