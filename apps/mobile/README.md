# Otto Mobile App

A React Native mobile app built with Expo. Thin client for the ottocode server.

## Getting Started

```bash
bun install
bun dev
```

## Tech Stack

- **Framework**: Expo / React Native
- **State**: TanStack Query
- **Database**: Drizzle ORM with expo-sqlite
- **Styling**: React Native Unistyles

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
