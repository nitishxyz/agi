# Troubleshooting

[← Back to README](../README.md) • [Docs Index](./index.md)

## Common Issues

### Provider not authorized
```bash
# Re-run authentication setup
otto auth login
```

### Database errors
```bash
# Reset local database
bun run db:reset
```

### Configuration issues
```bash
# Run diagnostics
otto doctor
```

### Need more diagnostics?

Use the built-in checks first:

```bash
otto doctor
```
