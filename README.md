# BOPADIGITAL API

RESTful API for BOPACORP S.A., powering the digital transformation of B2B telecommunications sales operations.

## About

BOPADIGITAL is a comprehensive digital platform that digitizes and centralizes the complete B2B sales lifecycle for BOPACORP S.A., a telecommunications company and strategic commercial partner of Movistar Ecuador.

This API serves as the single backend powering two client applications:
- **Web CRM/CMS** - Management interface for supervisors and coordinators
- **Mobile Field App** - Sales tool for field advisors

## Tech Stack

- **Runtime**: Node.js (v22+)
- **Framework**: Express.js 5.x
- **Language**: TypeScript 6.x (ESM only)
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Drizzle ORM
- **Validation**: Zod 4
- **Authentication**: JWT with bcrypt
- **Logging**: Pino
- **Testing**: Vitest
- **Linting/Formatting**: Biome

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- PostgreSQL database (Supabase)
- Access to `@bopacorp/shared` package registry

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Apply database migrations
npm run db:migrate

# Start development server
npm run dev
```

## Project Structure

```
src/
├── config/         # Environment and app configuration
├── db/schema/      # Drizzle ORM schema definitions
├── lib/            # Singletons (db client, logger, storage)
├── modules/        # Business domain modules
│   ├── auth/
│   ├── catalog/
│   ├── cms/
│   ├── crm/
│   ├── documents/
│   ├── employability/
│   ├── notifications/
│   ├── org/
│   └── reports/
├── shared/         # Middleware, errors, utils, types
├── scripts/        # Database seeders
└── index.ts        # Application entry point

drizzle/            # Generated SQL migrations
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm run check` | Lint + format + typecheck |
| `npm run lint` | Run Biome linter |
| `npm run format` | Run Biome formatter |
| `npm test` | Run tests |
| `npm run db:generate` | Generate migration from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Testing

```bash
# Run all tests
npm test

# Run single test file
npx vitest run src/path/to/file.test.ts

# Run with coverage
npx vitest --coverage
```

## Documentation

See `docs/` for detailed development guidelines:
- `api-conventions.md` - API response format, error handling
- `project-structure.md` - Module pattern, dependency rules
- `auth.md` - Authentication and authorization
- `drizzle-guide.md` - Database schema and ORM usage
- `git-workflow.md` - Branching and commit conventions

## Security

- Environment variables for sensitive data
- JWT tokens with expiration and role-based permissions
- Password hashing with bcrypt
- Input validation with Zod schemas
- Document encryption at rest (AES-256-GCM)
- Rate limiting on public endpoints

## Team

**ESPOL Software Engineering II** - Student development team at ESPOL (T3)

## License

ISC License
