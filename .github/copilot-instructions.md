# Code Contribution Guidelines

## Project Desciption
An fullstack solution and admin panel for creating websites with user authentication using the kempo suite of tools.
 - kempo-server
 - kempo-css
 - kempo-ui
 - kempo-testing-framework

## Project Structure
 - All code should be in the `src/` directory, with the exception of npm scripts.
 - All utility function module files should be in the `src/utils/` directory.

## Architecture: Four-Layer Separation

This project maintains strict separation between frontend, HTTP layer, backend logic, and database. See ARCHITECTURE.md for full details.

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
  // Pure data in, pure data out
  await db.delete(session).where(eq(session.token, token));
  return { success: true };
};

// ✅ GOOD: public/kempo/api/auth/logout/POST.js (HTTP layer)
export default async (request, response) => {
  const token = request.cookies.session_token; // Extract here
  const result = await logout({ token }); // Pass pure data
  response.json(result);
};
```

**When writing or modifying server/utils/:**
1. Accept only pure data as parameters
2. Never import from `public/` or `middleware/`
3. Return data or throw errors - no HTTP responses
4. Test by calling directly with plain objects - no mocking needed

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
  - If the shared logic is used in multiple files, create a utility function module file in `src/utils/`.

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

## Development Workflow

### Local Development Server
- **DO NOT** start a development server - one is already running
- Default port: **8083**
- Base URL: `http://localhost:8083`
- Documentation URLs follow the directory/file structure in `docs/` (e.g., `docs/components/color-picker.html` → `http://localhost:8083/components/color-picker.html`)
- Use this server for all testing and verification

### Testing and Verification
- **ALWAYS** verify changes using the live documentation on the running server
- Use Chrome DevTools Protocol (chrome-devtools-mcp) for interactive testing
- **DO NOT** create one-off test files or framework-less tests
- Test components in their natural documentation environment
- Validate both functionality and visual appearance
