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

#### HTTP Layer (`public/kempo/api/**/[METHOD].js`, `middleware/`)
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

**HTTP Layer** (`public/kempo/api/auth/login/POST.js`):
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

**HTTP layer** (`public/kempo/api/user/GET.js`):
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

