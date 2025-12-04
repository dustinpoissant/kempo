# Kempo PostgreSQL + Better Auth Setup

## Getting Started

### 1. Start the PostgreSQL Database

Start the PostgreSQL container using Docker Compose:

```bash
docker-compose up -d
```

To check if the database is running:

```bash
docker-compose ps
```

### 2. Push the Database Schema

Push the Better Auth schema to the database:

```bash
npm run db:push
```

This will create all the necessary tables for Better Auth in your PostgreSQL database.

### 3. Database Management Commands

- `npm run db:generate` - Generate migration files from schema changes
- `npm run db:migrate` - Run pending migrations
- `npm run db:push` - Push schema directly to database (useful for development)
- `npm run db:studio` - Open Drizzle Studio to view/edit data

### Database Connection

The database is accessible at:
- Host: `localhost`
- Port: `5432`
- Database: `kempo`
- Username: `kempo`
- Password: `kempo_dev_password`

Connection string: `postgresql://kempo:kempo_dev_password@localhost:5432/kempo`

### Stop the Database

```bash
docker-compose down
```

To remove all data:

```bash
docker-compose down -v
```

## Better Auth Tables

The following tables are created for Better Auth:

- `user` - User accounts
- `session` - User sessions
- `account` - OAuth provider accounts and credentials
- `verification` - Email verification and password reset tokens
