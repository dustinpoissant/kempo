# Code Contribution Guidelines

## Project Description
A fullstack cms solution for creating websites and apis with user authentication using the kempo suite of tools.
 - kempo-server
 - kempo-css
 - kempo-ui
 - kempo-testing-framework
 
This project will be installed by the user with `npm install kempo` and will live in their node_modules.
An init script ran with `npm kempo init` will be used to help setup their project.

## Project Structure
 - Frontend code is in the `app-public/` directory
  - This code is copied to the the consumers `public/` directory as a starting point for their project.
  - Internally we do `npm run dev` that runs this a server in this directory for development.
 - Backend utilities are in `server/utils/` directory
 - Middleware is in `middleware/` directory
 - Database schema and connection are in `server/db/` directory
 - API Route handlers are in `dist/kempo/api/**` as `[METHOD].js` files
 - The admin portal is in `/dist/admin/**` as `*.page.html` files.

## Architecture: Four-Layer Separation

This project maintains strict separation between frontend, HTTP layer, backend logic, and database. See CONTRIBUTING.md for full details.

### Critical Rule: Backend Utils Must Be HTTP-Agnostic

**Files in `server/utils/` MUST NEVER access HTTP-specific objects or properties:**

❌ **FORBIDDEN in server/utils/:**
- `request`, `response`, `req`, `res` objects
- `request.headers`, `request.cookies`, `request.body`, `request.query`, `request.params`
- `response.status()`, `response.json()`, `response.setHeader()`, `response.redirect()`
- Any HTTP-specific logic

✅ **REQUIRED in server/utils/:**
- Accept pure JavaScript data types: strings, numbers, objects, arrays
- Return pure data or throw errors
- Example: `export default async ({ token, userId, email }) => { ... }`

**Why:** Backend utils must work with ANY HTTP layer (web cookies, mobile Bearer tokens, CLI tools, webhooks). The HTTP layer (`public/*/[METHOD].js`, `middleware/`) extracts data from requests and passes it to utils.

**Example - WRONG:**
```javascript
// ❌ BAD: server/utils/auth/logout.js
export default async ({ headers }) => {
  const cookie = headers.cookie; // HTTP-specific!
  // ...
};
```

**Example - CORRECT:**
```javascript
// ✅ GOOD: server/utils/auth/logout.js
export default async ({ token }) => {
  await db.delete(session).where(eq(session.token, token));
  return [null, { success: true }];
};

// ✅ GOOD: public/kempo/api/auth/logout/POST.js (HTTP layer)
export default async (request, response) => {
  const token = request.cookies.session_token;
  const [error, result] = await logout({ token });
  
  if(error){
    return response.status(error.code).json({ error: error.msg });
  }
  
  response.json(result);
};
```

**When writing or modifying server/utils/:**
1. Accept only pure data as parameters
2. Never import from `public/` or `middleware/`
3. Return error tuples: `[null, data]` on success, `[{code, msg}, null]` on failure
4. Test by calling directly with plain objects - no mocking needed

## Error Handling Pattern

**ALL backend utilities (`server/utils/`) MUST use the structured error tuple pattern:**

```javascript
// Success
return [null, resultData];

// Failure
return [{ code: 404, msg: 'User not found' }, null];
```

### Critical Rules

1. **Always return a tuple** with exactly 2 elements
2. **First element**: 
   - `null` on success
   - `{ code, msg }` object on failure (code must be HTTP-compatible: 400, 401, 403, 404, 409, 500)
3. **Second element**:
   - Result data on success
   - `null` on failure
4. **Never throw errors** in server/utils/ - return error tuples instead
5. **Error messages** must be safe to display to end users

### Example

```javascript
// server/utils/users/getUser.js
export default async ({ userId }) => {
  if(!userId){
    return [{ code: 400, msg: 'User ID is required' }, null];
  }

  const foundUser = await db.select().from(user).where(eq(user.id, userId)).limit(1);

  if(!foundUser.length){
    return [{ code: 404, msg: 'User not found' }, null];
  }

  return [null, foundUser[0]];
};
```

### HTTP Layer Usage

`request.body` is eagerly parsed based on `Content-Type` before the route handler runs. For JSON requests, it's a parsed object. For form data, it's a parsed object via `URLSearchParams`. For other types, it's the raw string. For requests with no body, it's `null`.

```javascript
// JSON body — already parsed
const { id, name } = request.body;

// Query params and cookies are also eagerly parsed
const userId = request.query.id;
const token = request.cookies.session_token;
```

```javascript
// public/kempo/api/user/GET.js
export default async (request, response) => {
  const userId = request.query.id;
  const [error, user] = await getUser({ userId });
  
  if(error){
    return response.status(error.code).json({ error: error.msg });
  }
  
  response.json({ user });
};
```

## Coding Style Guidelines

### Code Organization
Use multi-line comments to separate code into logical sections. Group related functionality together.
  - Example: In Lit components, group lifecycle callbacks, event handlers, public methods, utility functions, and rendering logic separately.

```javascript
/*
  Code Section
*/
```

### Avoid single-use variables/functions
Avoid defining a variable or function to only use it once; inline the logic where needed. Some exceptions include:
  - recursion
  - scope encapsulation (IIFE)
  - context changes

### Minimal Comments, Empty Lines, and Spacing

Use minimal comments. Assume readers understand the language. Some exceptions include:
  - complex logic
  - anti-patterns
  - code organization

Do not put random empty lines within code; put them where they make sense for readability, for example:
  - above and below definitions for functions and classes.
  - to help break up large sections of logic to be more readable. If there are 100 lines of code with no breaks, it gets hard to read.
  - above multi-line comments to indicate the comment belongs to the code below

No  empty lines in css.

End each file with an empty line.

End each line with a `;` when possible, even if it is optional.

Avoid unnecessary spacing, for example:
  - after the word `if`
  - within parentheses for conditional statements

```javascript
let count = 1;

const incrementOdd = (n) => {
  if(n % 2 !== 0){
    return n++;
  }
  return n;
};

count = incrementOdd(count);
```

### Prefer Arrow Functions
Prefer the use of arrow functions when possible, especially for class methods to avoid binding. Use normal functions if needed for preserving the proper context.
 - For very basic logic, use implicit returns
 - If there is a single parameter, omit the parentheses.
```javascript
const addOne = n => n + 1;
```

### Module Exports
  - If a module has only one export, use the "default" export, not a named export.
    - Do not declare the default export as a const or give it a name; just export the value.

```javascript
export default (n) => n + 1;
```
  - If a module has multiple exports, use named exports and do not use a "default" export.

### Code Reuse
Create utility functions for shared logic.
  - If the shared logic is used in a single file, define a utility function in that file.
  - If the shared logic is used in multiple files, create a utility function module file in `server/utils/` (for backend logic) or in the appropriate location for frontend code.

### Naming
Do not prefix identifiers with underscores.
  - Never use leading underscores (`_`) for variable, property, method, or function names.
  - Use clear, descriptive names without prefixes.
  - When true privacy is needed inside classes, prefer native JavaScript private fields (e.g., `#myField`) instead of simulated privacy via underscores.

## Components

### Base Component Architecture

The project provides three base components for different rendering strategies. Choose the appropriate base component and extend it:

#### ShadowComponent
For components that need shadow DOM encapsulation and automatic `/kempo.css` stylesheet injection.

```javascript
import ShadowComponent from './ShadowComponent.js';

export default class MyComponent extends ShadowComponent {
  render() {
    return html`<p>Shadow DOM content with scoped styles</p>`;
  }
}
```

#### LightComponent  
For components that render directly to light DOM without shadow DOM encapsulation.

```javascript
import LightComponent from './LightComponent.js';

export default class MyComponent extends LightComponent {
  renderLightDom() {
    return html`<p>Light DOM content</p>`;
  }
}
```

#### HybridComponent
For components that need both shadow DOM (with automatic `/kempo.css`) and light DOM rendering.

```javascript
import HybridComponent from './HybridComponent.js';

export default class MyComponent extends HybridComponent {
  render() {
    return html`<p>Shadow DOM content</p>`;
  }
  
  renderLightDom() {
    return html`<p>Light DOM content alongside natural children</p>`;
  }
}
```

**Important:** Always call `super.updated()` when overriding the `updated()` method in LightComponent or HybridComponent to ensure proper rendering.

### Component Architecture and Communication

- Use methods to cause actions; do not emit events to trigger logic. Events are for notifying that something already happened.
  - Prefer `el.closest('ktf-test-framework')?.enqueueSuite({...})` over firing an `enqueue` event.

- Wrap dependent components inside a parent `ktf-test-framework` element. Children find it via `closest('ktf-test-framework')` and call its methods. The framework can query its subtree to orchestrate children.

- Avoid `window` globals and global custom events for coordination. If broadcast is needed, scope events to the framework element; reserve window events for global, non-visual concerns (e.g., settings changes).

## Styling with kempo-css

**DO NOT write custom CSS.** This project uses [kempo-css](https://github.com/dustinpoissant/kempo-css). Most native HTML elements are already styled by default, and nearly everything else can be handled with its utility classes. Never add `<style>` blocks or inline `style` attributes — always reach for a utility class first.

Before working on any UI, read the full kempo-css reference to understand what's available: https://raw.githubusercontent.com/dustinpoissant/kempo-css/refs/heads/main/llms.txt

## Icons with kempo-ui

**DO NOT use HTML entities, Unicode characters, or emoji for icons** (e.g. no `&larr;`, `&#x2715;`, `→`, `✕`). Use `<k-icon>` from kempo-ui instead.

```html
<script type="module" src="/kempo-ui/components/Icon.js"></script>
<k-icon name="arrow-left"></k-icon>
```

`<k-icon>` resolves SVG files by `name` from the configured icon paths (`/icons` by default). It also supports `src` for a direct URL, plus `rotation`, `direction`, and `animation` attributes.

Read the full kempo-ui reference to see all available components and icons: https://raw.githubusercontent.com/dustinpoissant/kempo-ui/refs/heads/main/llm.txt

## Development Workflow

### Local Development Server
- **DO NOT** start a development server - one is already running
- Default port: **9876**
- Base URL: `http://localhost:9876`
- Documentation URLs follow the directory/file structure in `public/` (e.g., `public/admin/index.html` → `http://localhost:9876/admin/`)
- Use this server for all testing and verification

### Testing and Verification
- **ALWAYS** verify changes using the live documentation on the running server
- Use Chrome DevTools Protocol (chrome-devtools-mcp) for interactive testing
- **DO NOT** create one-off test files or framework-less tests
- Test components in their natural documentation environment
- Validate both functionality and visual appearance

### Admin Portal Credentials
- **Email:** `copilot@kempo.dev`
- **Password:** `CopilotAdmin123!`
- **Admin URL:** `http://localhost:9876/admin/`
- Use these credentials to log in and test admin portal changes
