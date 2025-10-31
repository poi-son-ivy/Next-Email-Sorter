# Email Sorter

A Next.js application for sorting and managing Gmail emails with OAuth authentication.

## Current Status

**Phase 1: Gmail OAuth Authentication** ✅ Complete

The application now supports:
- Sign in with Google OAuth
- Gmail API access with appropriate scopes (readonly and modify)
- Secure token storage in NextAuth sessions
- Basic authentication UI

## Quick Start

### Prerequisites
- Node.js 18+
- A Google Cloud account
- Gmail account for testing

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Google OAuth**

   Follow the detailed instructions in [SETUP.md](./SETUP.md) to:
   - Create a Google Cloud project
   - Enable Gmail API
   - Set up OAuth credentials
   - Configure environment variables

3. **Set environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## What's Next?

Future phases will include:
- Fetching and displaying Gmail emails
- Email categorization and sorting
- Custom rules and filters
- Automated email organization

## Tech Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **NextAuth.js v5** for authentication
- **Tailwind CSS** for styling
- **Google Gmail API** for email access

## Documentation

- [SETUP.md](./SETUP.md) - Detailed OAuth setup instructions
- [CLAUDE.md](./CLAUDE.md) - Architecture and development guide

## License

ISC
