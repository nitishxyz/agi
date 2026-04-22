# StackForge Mobile App

A React Native mobile app built with Expo.

## Getting Started

```bash
bun install
bun dev
```

## Tech Stack

- **Framework**: Expo / React Native
- **Auth**: Better Auth (email OTP via Resend)
- **State**: TanStack Query
- **Database**: Drizzle ORM with expo-sqlite
- **Styling**: React Native Unistyles

## Auth notes

- Auth client setup lives in `src/lib/auth-client.ts`
- Auth hook lives in `src/hooks/use-auth.ts`
- User metadata storage lives in `src/services/auth-storage.ts`
- Backend sync happens through `POST /auth/sync`
- Authenticated API calls use the Better Auth session cookie
- No wallet provider or signing flow is currently part of auth

## Project Structure

```
app/              # Expo Router screens
src/
  components/     # UI components
  hooks/          # Custom React hooks
  services/       # API and business logic
  db/             # Local database schema
  providers/      # React context providers
  utils/          # Utility functions
```
