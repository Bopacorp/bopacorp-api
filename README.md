# BOPADIGITAL API

RESTful API for BOPACORP S.A., powering the digital transformation of B2B telecommunications sales operations.

## 🏢 About

BOPADIGITAL is a comprehensive digital platform that digitizes and centralizes the complete B2B sales lifecycle for BOPACORP S.A., a telecommunications company and strategic commercial partner of Movistar Ecuador.

This API serves as the single backend powering two client applications:
- **Web CRM/CMS** - Management interface for supervisors and coordinators
- **Mobile Field App** - Sales tool for field advisors

## 🛠 Tech Stack

- **Runtime**: Node.js (v22+)
- **Framework**: Express.js 5.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Validation**: Zod
- **Authentication**: JWT with bcrypt
- **Testing**: Vitest + Supertest

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0
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
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Authentication
JWT_SECRET="your-secret-key-here"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV=development
```

## 📁 Project Structure

```
.
├── prisma/
│   └── schema.prisma       # Database schema definition
├── src/
│   ├── config/             # Configuration files
│   ├── lib/                # Shared libraries (Prisma client)
│   ├── modules/            # Business domain modules
│   │   ├── auth/           # Authentication (SEG)
│   │   ├── users/          # User management
│   │   ├── crm/            # Customer relationship (CRM)
│   │   ├── offer-matrix/   # Offer matrix (MAT)
│   │   ├── supervision/    # Supervision tools (SUP)
│   │   ├── documents/      # Document management (DOC)
│   │   ├── reporting/      # Reports & KPIs (REP)
│   │   ├── catalog/        # Service catalog (CAT)
│   │   ├── cms/            # Content management (CMS)
│   │   └── jobs/           # Job listings (EMP)
│   ├── shared/             # Cross-cutting concerns
│   │   ├── middleware/     # Auth, roles, error handling
│   │   ├── utils/          # Helper functions
│   │   └── types/          # Shared TypeScript types
│   ├── routes/
│   │   └── index.ts        # Route aggregation
│   └── index.ts            # Application entry point
├── .env                    # Environment variables (not in git)
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run db:migrate` | Run database migrations |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:push` | Push schema changes to database |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm test` | Run tests with Vitest |

## 🏛 Architecture Overview

### Modular Monolith

Each business domain is encapsulated in its own module under `src/modules/`:

```
modules/[module-name]/
├── [name].routes.ts      # Route definitions
├── [name].controller.ts  # Request handlers
├── [name].service.ts     # Business logic
└── [name].schema.ts      # Zod validation schemas
```

### Authentication & Authorization

- **JWT-based authentication** with access tokens
- **Role-based access control** with 5 hierarchical roles:
  - `ADVISOR` - Field sales executive
  - `SUPERVISOR` - Sales manager
  - `MANAGER` - Executive/director
  - `COORDINATOR` - Operations
  - `WEB_ADMIN` - Website administrator

### Middleware Stack

1. **CORS** - Cross-origin request handling
2. **Helmet** - Security headers
3. **Rate Limiting** - API protection
4. **Morgan** - HTTP request logging
5. **Auth Middleware** - JWT verification
6. **Roles Middleware** - Permission enforcement
7. **Error Handler** - Global error catching

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## 📚 Documentation

- **Prisma Schema**: See `prisma/schema.prisma`
- **API Routes**: Check `src/modules/[module]/[module].routes.ts`
- **Validation Schemas**: Check `src/modules/[module]/[module].schema.ts`

## 🔒 Security

- Environment variables for sensitive data
- JWT tokens with expiration
- Password hashing with bcrypt
- Rate limiting on all endpoints
- Helmet for security headers
- Input validation with Zod

## 👥 Team

**Espol Developers** - Student development team at ESPOL (Escuela Superior Politécnica del Litoral)

## 📄 License

ISC License - See package.json for details

---

## 🤝 Contributing

This is an academic project. For questions or contributions, contact the team via GitHub issues.

## 📞 Support

- **Repository**: https://github.com/Bopacorp/bopacorp-api
- **Issues**: https://github.com/Bopacorp/bopacorp-api/issues
