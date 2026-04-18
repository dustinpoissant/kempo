# Project Structure

After running `npx kempo init`, your project looks like this:

```
my-site/
├── .env                      # Environment variables (DATABASE_URL, etc.)
├── .gitignore
├── docker-compose.yml        # Local PostgreSQL via Docker
├── drizzle.config.js         # Drizzle ORM config
├── package.json
├── public/                   # Your website (pages, assets, API routes)
│   ├── .config.json          # Server routing and middleware config
│   ├── index.page.html       # Home page
│   ├── styles.css            # Your site's stylesheet
│   ├── default.template.html # Default page layout
│   ├── nav.fragment.html     # Navigation fragment
│   ├── login/
│   ├── register/
│   ├── account/
│   └── admin/
└── server/
    └── db/
        └── schema.js         # Your app's custom database tables
```

## The `public/` Directory

This is your website. The kempo-server routing system maps the file structure to URLs:

- `public/index.page.html` → `GET /`
- `public/blog/index.page.html` → `GET /blog/`
- `public/api/posts/GET.js` → `GET /api/posts`
- `public/api/posts/[id]/DELETE.js` → `DELETE /api/posts/:id`

See the [kempo-server routing docs](https://github.com/dustinpoissant/kempo-server) for the full routing reference.

### `.config.json`

The server configuration file. The most important sections:

```json
{
  "port": 3000,
  "customRoutes": {
    "/kempo/**": "../node_modules/kempo/dist/kempo/**"
  },
  "middleware": [
    "../node_modules/kempo/middleware/auth.js",
    "../node_modules/kempo/middleware/extension-scope-router.js"
  ]
}
```

`customRoutes` maps URL prefixes to directories. The kempo middleware handles authentication and extension static file serving.

## The `server/db/schema.js` File

Defines your application's database tables. It re-exports kempo's built-in schema and adds your own:

```javascript
// Re-export all kempo tables so drizzle-kit includes them in migrations
export * from 'kempo/server/db/schema.js';

// Your custom tables
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const post = pgTable('post', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});
```

Run `npx drizzle-kit push` after adding or changing tables.

## Kempo's Internal Structure

You don't modify these, but knowing where things live is useful for imports:

```
node_modules/kempo/
├── dist/kempo/
│   ├── api/           # REST API route handlers (/kempo/api/**)
│   └── admin/         # Admin panel pages (/kempo/admin/**)
├── middleware/
│   ├── auth.js        # Session + permission middleware
│   └── extension-scope-router.js
├── server/
│   ├── db/
│   │   ├── schema.js  # Built-in database tables
│   │   └── index.js   # Drizzle db instance
│   └── utils/         # All backend utility functions
└── scripts/
    ├── init-db.js     # Seeds default settings, permissions, groups
    ├── make-admin.js
    └── remove-admin.js
```

## Adding Your Own API Routes

Create route handler files inside `public/`:

```javascript
// public/api/posts/GET.js
import db from 'kempo/server/db/index.js';
import { post } from '../../../server/db/schema.js';

export default async (request, response) => {
  const posts = await db.select().from(post);
  response.json({ posts });
};
```

For authenticated routes, extract the session token from cookies and use the permission utils:

```javascript
import currentUserHasPermission from 'kempo/server/utils/permissions/currentUserHasPermission.js';

export default async (request, response) => {
  const token = request.cookies.session_token;
  const [err, allowed] = await currentUserHasPermission(token, 'system:admin:access');
  if(err || !allowed) return response.status(403).json({ error: 'Forbidden' });

  // ...
};
```
