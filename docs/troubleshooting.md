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

### Debug mode
```bash
# Enable debug output
DEBUG_OTTO=1 otto "<your prompt>"
```
