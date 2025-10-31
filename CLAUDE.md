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
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js v5 (beta)
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
- `/types` - TypeScript type definitions
  - `next-auth.d.ts` - NextAuth session/JWT type extensions
- `auth.ts` - NextAuth configuration with Google provider
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
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

## Development Notes

- The project uses Next.js App Router with Server Components by default
- Auth components use Server Actions for sign-in/sign-out
- Session data includes Gmail access tokens for API calls
- TypeScript strict mode is enabled
