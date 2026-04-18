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
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Validation**: Zod
- **Authentication**: JWT with bcrypt
- **Testing**: Vitest

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- PostgreSQL database (local or Supabase)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Set up database
npx prisma migrate dev
npx prisma generate

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
JWT_SECRET="your-secret-key-here"
PORT=3000
NODE_ENV=development
```

## Project Structure

```
src/
├── config/         # Configuration files
├── lib/           # Shared libraries
├── modules/       # Business domain modules
├── shared/        # Cross-cutting concerns
└── index.ts       # Application entry point

prisma/
├── schema.prisma  # Database schema
└── migrations/    # Database migrations
generated/         # Generated Prisma client
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm start` | Start production server |
| `npm test` | Run tests |

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Documentation

See `AGENTS.md` for detailed development guidelines and conventions.

## Security

- Environment variables for sensitive data
- JWT tokens with expiration
- Password hashing with bcrypt
- Input validation with Zod

## Team

**Espol Developers** - Student development team at ESPOL

## License

ISC License

## Support

- **Repository**: https://github.com/Bopacorp/bopacorp-api
- **Issues**: https://github.com/Bopacorp/bopacorp-api/issues
