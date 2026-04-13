# Dynamic Coaching Center - Finance Manager

## Overview

Dynamic Coaching Center is a personal finance management application designed for tracking tuition-based income and expenses. It provides a dashboard with visual analytics, payment tracking by student/batch/month, and expense categorization. The application follows a full-stack TypeScript architecture with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.
Currency: Bangladeshi Taka (৳ / BDT).

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite for development and production builds
- **Data Visualization**: Recharts for income vs expense charts

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints under `/api/` prefix
- **Validation**: Zod schemas for request/response validation, shared between client and server

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema-to-validation integration
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Managed via `drizzle-kit push` command

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts`: Database table definitions and Zod insert schemas
- `routes.ts`: API route definitions with paths, methods, and response schemas

### Recent Changes (January 26, 2026)
- Added dedicated login entry routes for `/student`, `/teacher`, and `/admin`, each with a fixed-role login form and automatic redirects for authenticated users.
- Migrated the project for Replit runtime compatibility: configured the web workflow on port 5000, added Vite preview host support, and verified the app launches successfully in the Replit preview.
- Hardened authentication responses and API logging so user password fields are not returned to the browser or written to request logs.

### GitHub Sync Notes
- Last attempted push target: `https://github.com/javed0725/dccapp`.
- Push is blocked until GitHub authentication is connected or a secure GitHub token is provided.
- Rebranded app to **Dynamic Coaching Center**.
- Updated all currency symbols to **Bangladeshi Taka (৳)**.
- Replaced default logos with custom coaching center logo.
- Implemented RBAC for Teachers and Authority.
- Renamed 'Income' to 'Payment' throughout the UI.

### Build Process
- Development: Vite dev server with HMR proxied through Express
- Production: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Server dependencies are selectively bundled to optimize cold start times

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage (available but not currently active)

### UI Component Libraries
- **Radix UI**: Headless component primitives (dialogs, dropdowns, forms, etc.)
- **Shadcn/ui**: Pre-styled component layer using Tailwind CSS
- **Lucide React**: Icon library

### Data & Forms
- **TanStack React Query**: Async state management and caching
- **React Hook Form**: Form state management with `@hookform/resolvers`
- **Zod**: Schema validation for forms and API requests
- **date-fns**: Date formatting utilities

### Visualization
- **Recharts**: Chart library for dashboard analytics

### Development Tools
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner (development only)
