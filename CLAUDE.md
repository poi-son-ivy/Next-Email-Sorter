# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next-Email-Sorter is a Gmail email sorting application built with Next.js 15, TypeScript, and NextAuth.js. The application allows users to authenticate with their Gmail account and manage/sort their emails.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Authentication**: NextAuth.js v5 (beta)
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Prisma with Neon adapter
- **Email API**: Google Gmail API via googleapis package

### Project Structure
- `/app` - Next.js app router pages and layouts
  - `/api/auth/[...nextauth]` - NextAuth API routes
  - `page.tsx` - Main homepage with auth UI
  - `layout.tsx` - Root layout
  - `globals.css` - Global styles
- `/components` - React components
  - `sign-in.tsx` - Google sign-in button
  - `sign-out.tsx` - Sign-out button
  - `user-info.tsx` - Display authenticated user info
- `/lib` - Utility functions and configurations
  - `auth.ts` - NextAuth configuration with Google provider
  - `prisma.ts` - Prisma client singleton with Neon adapter
  - `/generated/prisma` - Generated Prisma client
- `/prisma` - Database schema and migrations
  - `schema.prisma` - Database schema with User, Account, Session, Email models
  - `/migrations` - Database migration history
- `/types` - TypeScript type definitions
  - `next-auth.d.ts` - NextAuth session/JWT type extensions
- `next.config.ts` - Next.js configuration
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS v4
- `prisma.config.ts` - Prisma configuration
- `tsconfig.json` - TypeScript configuration

### Authentication Flow
1. User clicks "Sign in with Google" button
2. NextAuth redirects to Google OAuth consent screen
3. User grants permissions for Gmail access (readonly and modify scopes)
4. Google redirects back with access token and refresh token
5. Tokens are stored in JWT session
6. Access token is available in session for Gmail API calls

### Gmail API Scopes
The application requests these scopes:
- `gmail.readonly` - Read emails
- `gmail.modify` - Modify emails (labels, categories, etc.)
- `openid`, `userinfo.email`, `userinfo.profile` - Basic user info

Access tokens are persisted in the session with refresh token support.

## Environment Setup

1. Copy `.env.example` to `.env`
2. Follow instructions in `SETUP.md` to:
   - Create Google Cloud project
   - Enable Gmail API
   - Configure OAuth consent screen
   - Create OAuth credentials
   - Set environment variables

Required environment variables:
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `NEXTAUTH_URL` - Application URL (default: http://localhost:3000)
- `DATABASE_URL` - Neon PostgreSQL pooled connection string
- `DIRECT_DATABASE_URL` - Neon PostgreSQL direct connection string (for migrations)

## Database Schema

The application uses Prisma with the following models:

- **User** - User accounts with email, name, and OAuth info
- **Account** - OAuth provider accounts (stores Google OAuth tokens)
- **Session** - User sessions for NextAuth
- **VerificationToken** - Email verification tokens
- **Email** - Cached Gmail messages with metadata (gmailId, subject, from, to, labels, etc.)

Key relationships:
- Users have many Accounts, Sessions, and Emails
- Emails are linked to Users for quick retrieval
- Access tokens stored in Account model for Gmail API calls

### Database Commands

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio to view/edit data
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Development Notes

- The project uses Next.js App Router with Server Components by default
- Auth components use Server Actions for sign-in/sign-out
- Session data includes Gmail access tokens for API calls
- Prisma client is configured with Neon adapter for serverless deployment
- Database connection uses WebSocket for local development
- TypeScript strict mode is enabled
