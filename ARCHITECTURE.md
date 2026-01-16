# Architecture Overview

## Philosophy: Clear Separation of Concerns

This project maintains strict boundaries between the frontend, HTTP layer, business logic, and database. This separation provides security, flexibility, and maintainability that modern "full-stack" frameworks sacrifice for convenience.

## Why This Matters

"Server components" and "server functions" that can be called from the frontend create attack surfaces. This project keeps clear, explicit boundaries.

## Four-Layer Architecture

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

## Layer Rules

### Frontend Layer (`public/`)
**Can:**
- HTML, CSS, client-side JavaScript
- Import client-side libraries (Lit, etc.)
- Make fetch() requests to API endpoints

**Cannot:**
- Import from `server/` or `middleware/`
- Access database directly
- Access environment variables or secrets
- Execute server-side code

### HTTP Layer (`public/kempo/api/**/[METHOD].js`, `middleware/`)
**Can:**
- Access `request.headers`, `request.cookies`, `request.body`
- Extract authentication tokens from cookies or Authorization headers
- Call backend utils with extracted data
- Set HTTP status codes and headers
- Format responses as JSON/HTML

**Cannot:**
- Contain business logic (delegate to `server/utils/`)
- Access database directly (call utils instead)

### Backend Logic (`server/utils/`)
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

### Database Layer (`server/db/`)
**Can:**
- Define schema
- Manage migrations
- Provide database connection

**Cannot:**
- Contain business logic
- Access HTTP layer

## Why This Separation?

### Security
- No confusion about what code runs where
- HTTP layer validates and sanitizes all input before passing to backend
- Backend utils can't accidentally leak HTTP headers or cookies
- Clear audit trail: every backend call originates from an explicit HTTP endpoint

### Flexibility
Multiple frontends can use the same backend:
- Web app (cookie-based auth)
- Mobile app (Bearer token auth)
- CLI tool (API key auth)
- Third-party integrations (OAuth)

Just create different HTTP layers - the backend stays the same.

### Maintainability
- Backend utils are pure functions - easy to test without mocking HTTP
- Change authentication method? Update middleware, utils stay the same
- Swap frontend framework? Backend unaffected
- No magic - explicit boundaries make debugging straightforward

### No Build Complexity
- Frontend uses native ES modules (Lit)
- No transpilation during development
- What you write is what runs
- Source maps not needed - debug actual code

## Example: Login Flow

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
  const result = await loginEmail({ email, password });
  
  if(result.error){
    return response.status(400).json({ error: result.error });
  }
  
  response.setHeader('Set-Cookie', `session_token=${result.sessionToken}; HttpOnly; Secure`);
  response.json({ user: result.user });
};
```

**Backend Logic** (`server/utils/auth/loginEmail.js`):
```javascript
export default async ({ email, password }) => {
  // Validate credentials, create session
  // Returns { user, sessionToken } or { error }
};
```

Notice:
- Frontend only knows about HTTP
- HTTP layer extracts data, calls utils, handles cookies
- Backend util is pure: takes email/password, returns data

## Supporting Mobile Apps

Create a separate HTTP layer for mobile with Bearer tokens:

**mobile-api/auth/login/POST.js**:
```javascript
import loginEmail from '../../server/utils/auth/loginEmail.js';

export default async (request, response) => {
  const { email, password } = await request.json();
  const result = await loginEmail({ email, password });
  
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
  const session = await getSession({ token });
  response.json({ user: session.user });
};
```

Same backend utils, different HTTP layer.

## Testing

Backend utils are pure functions - test them directly:

```javascript
import loginEmail from '../server/utils/auth/loginEmail.js';

test('login with valid credentials', async () => {
  const result = await loginEmail({
    email: 'test@example.com',
    password: 'password123'
  });
  
  assert(result.user);
  assert(result.sessionToken);
});
```

No need to mock HTTP, cookies, or headers.

## This is Old-School (And That's Good)

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
