# Gmail OAuth Setup Instructions

This guide will help you set up Google OAuth credentials to enable Gmail access.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Email Sorter") and click "Create"

## Step 2: Enable Gmail API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on it and press "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type and click "Create"
3. Fill in the required fields:
   - App name: Email Sorter
   - User support email: Your email
   - Developer contact: Your email
4. Click "Save and Continue"
5. On the "Scopes" screen, click "Add or Remove Scopes"
6. Add these scopes:
   - `.../auth/gmail.readonly`
   - `.../auth/gmail.modify`
7. Click "Update" then "Save and Continue"
8. Add test users (your Gmail account) and click "Save and Continue"

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Name it (e.g., "Email Sorter Web Client")
5. Under "Authorized redirect URIs", add:
   - `http://localhost:3000/api/auth/callback/google`
   - For production, add: `https://yourdomain.com/api/auth/callback/google`
6. Click "Create"
7. Copy the Client ID and Client Secret

## Step 5: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in:
   - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID`: Paste your Client ID
   - `GOOGLE_CLIENT_SECRET`: Paste your Client Secret

## Step 6: Run the Application

```bash
npm run dev
```

Navigate to `http://localhost:3000` and test the OAuth connection!

## Troubleshooting

- **Redirect URI mismatch**: Make sure the redirect URI in Google Console exactly matches `http://localhost:3000/api/auth/callback/google`
- **Access blocked**: Add your email as a test user in the OAuth consent screen
- **Token errors**: Make sure you've enabled the Gmail API and added the correct scopes
