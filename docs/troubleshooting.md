# Troubleshooting

[← Back to README](../README.md) • [Docs Index](./index.md)

## Common Issues

### Provider not authorized
```bash
# Re-run authentication setup
agi auth login
```

### Database errors
```bash
# Reset local database
bun run db:reset
```

### Configuration issues
```bash
# Run diagnostics
agi doctor
```

### Debug mode
```bash
# Enable debug output
DEBUG_AGI=1 agi "<your prompt>"
```
