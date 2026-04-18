# Getting Started

## Requirements

- Node.js 18+
- Docker (for the local PostgreSQL database) or an existing PostgreSQL connection

## Installation

Create a new directory for your project and run:

```bash
npm install kempo
npx kempo init
```

The init wizard will prompt you to:
1. Set up a PostgreSQL database (via Docker or an existing URL)
2. Run the initial database migration
3. Create an admin user

### Manual Setup

If you prefer to set things up yourself without the wizard:

```bash
# 1. Start a PostgreSQL database
docker compose up -d

# 2. Push the schema to the database
npx drizzle-kit push

# 3. Seed the database with default settings and permissions
node node_modules/kempo/scripts/init-db.js

# 4. Start the server
npm start
```

Your site is now running at `http://localhost:3000`.

## Creating an Admin User

Register at `/register`, then run:

```bash
node node_modules/kempo/scripts/make-admin.js
```

Enter the user's email when prompted. To remove admin access:

```bash
node node_modules/kempo/scripts/remove-admin.js
```

## Environment Variables

The `.env` file created during init contains:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `RESEND_API_KEY` | (Optional) Resend API key for transactional email |
| `PORT` | Server port (default: 3000) |

## Scaffolded Pages

These pages are copied into your `public/` directory and are fully yours to customize:

| Route | Purpose |
|---|---|
| `/` | Home page |
| `/login` | Login form |
| `/register` | Registration form |
| `/forgot-password` | Password recovery |
| `/reset-password/[token]` | Password reset link handler |
| `/verify-email/[token]` | Email verification link handler |
| `/account` | Authenticated user account page |
| `/admin` | Admin dashboard |

## Next Steps

- [Project Structure](project-structure.md) — understand what got scaffolded
- [Content Management](content-management.md) — start building pages
- [Users, Auth & Permissions](users-auth-permissions.md) — customize the auth system
