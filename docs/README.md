# AGI Documentation

This directory contains the documentation for AGI CLI and SDK.

## 📚 Quick Links

- **[Documentation Index](index.md)** - Complete documentation overview
- **[Getting Started](getting-started.md)** - Installation and first steps
- **[Embedding Guide](embedding-guide.md)** - Embed AGI in your applications
- **[Configuration](configuration.md)** - Configuration system and fallback priority
- **[Architecture](architecture.md)** - System design and structure

## 🎯 Documentation by Use Case

### I want to use AGI CLI
1. [Getting Started](getting-started.md)
2. [Usage Guide](usage.md)
3. [Configuration](configuration.md)
4. [Troubleshooting](troubleshooting.md)

### I want to embed AGI in my app
1. [Embedding Guide](embedding-guide.md) ⭐
2. [Configuration](configuration.md)
3. [API Reference](api.md)
4. [Architecture](architecture.md)

### I want to contribute to AGI
1. [Contributing Guidelines](../AGENTS.md)
2. [Development Workflow](development.md)
3. [Architecture](architecture.md)
4. [Publishing](publishing.md)

## 📁 Documentation Structure

```
docs/
├── README.md                     # This file
├── index.md                      # Complete documentation index
│
├── Getting Started
│   ├── getting-started.md        # Installation and setup
│   ├── usage.md                  # Basic CLI usage
│   └── configuration.md          # Configuration system
│
├── Developer Guides
│   ├── embedding-guide.md        # Embed AGI (⭐ Main guide)
│   ├── api.md                    # HTTP API reference
│   ├── customization.md          # Custom agents and tools
│   └── agents-tools.md           # Built-in agents and tools
│
├── Architecture
│   ├── architecture.md           # Overall system design
│   ├── sdk-architecture.md       # SDK internal structure
│   ├── dependency-graph.md       # Package dependencies
│   ├── ai-sdk-v5.md             # AI SDK v5 integration
│   ├── streaming-overhaul.md    # SSE streaming architecture
│   ├── tools-and-artifacts.md   # Tool system design
│   └── file-editing-solution.md # File editing approach
│
└── Reference
    ├── environment.md            # Environment variables
    ├── development.md            # Development workflow
    ├── publishing.md             # Release process
    ├── contributing.md           # Contribution guide
    ├── troubleshooting.md        # Common issues
    └── license.md                # MIT license
```

## 🔄 Recent Changes

**October 2025**: Major documentation cleanup
- ✅ Removed 7 outdated/redundant docs
- ✅ Consolidated embedding documentation into single guide
- ✅ Updated configuration docs with hybrid fallback system
- ✅ Moved planning docs to `/plans` directory
- ✅ Updated all cross-references

## 🚀 What's New

The **Embedding Guide** now documents the complete hybrid fallback system:
1. Injected config (highest priority)
2. Environment variables
3. Config files (fallback)

This allows AGI to work in any environment: embedded apps, CI/CD, traditional CLI, or hybrid.

---

For the complete documentation index, see [index.md](index.md)
