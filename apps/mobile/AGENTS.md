# AI Agent Guidelines

This document provides guidelines for AI agents working on the Otto mobile app.

## Key Points

1. **Do NOT start dev servers** - user handles `bun dev`
2. **Do NOT run migrations** - only update schema files in `src/db/schema/`
3. **Do NOT modify `drizzle/` directory** - generated files managed by user

## Project Structure

- `app/` - Expo Router screens and layouts
- `src/components/ui/` - Reusable UI primitives
- `src/hooks/` - Custom React hooks
- `src/services/` - API client and business logic
- `src/db/schema/` - Drizzle ORM schema definitions

## Styling

Uses React Native Unistyles. Check `src/utils/unistyles.ts` for theme configuration.

## Architecture

This is a thin client for the ottocode server. Auth is handled via the server's API using bearer tokens. See `src/services/api/client.ts`.
