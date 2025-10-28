# Contributing to DashReader

Thank you for your interest in contributing to DashReader! This document provides guidelines and instructions for developers.

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm
- Obsidian (for testing)
- TypeScript knowledge

### Development Setup

```bash
# Clone the repository to your vault's plugin folder
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/inattendu/dashreader

# Install dependencies
cd dashreader
npm install

# Build for production
npm run build

# Development mode with watch
npm run dev

# Type checking
npx tsc --noEmit
```

### Testing

```bash
# Install plugin in a test vault
./install-local.sh /path/to/test/vault

# Reload Obsidian after changes
# macOS: Cmd+R
# Windows/Linux: Ctrl+R
```

## Development Guidelines

### Code Quality Standards

- **TypeScript**: Use strict mode, avoid `any` types
- **Functions**: Keep functions < 50 lines, single responsibility
- **Naming**: Descriptive names, camelCase for variables/functions
- **Comments**: Document complex logic, avoid obvious comments
- **Formatting**: Use consistent indentation (2 spaces)

### Obsidian Plugin Guidelines

**Critical requirements** (will fail review if violated):

1. **Security**: Never use `innerHTML`/`outerHTML` with user content
   - Use `createEl()`, `createDiv()`, `createSpan()` instead
2. **Styling**: Prefer CSS classes over inline styles
   - Use `toggleClass()` for conditional styling
3. **Logging**: Minimize `console.log()`, use Logger service
4. **Resources**: Clean up timers, event listeners in `onunload()`

See [CLAUDE.md](CLAUDE.md) for detailed architecture guidelines.

### Git Workflow

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to branch: `git push origin feature/amazing-feature`
5. **Open a Pull Request** with clear description

#### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring
- `docs:` - Documentation changes
- `test:` - Test additions/modifications
- `chore:` - Maintenance tasks

## Project Structure

```text
dashreader/
├── src/
│   ├── Core (6 files)
│   │   ├── rsvp-view.ts         # UI layer
│   │   ├── rsvp-engine.ts       # Reading engine
│   │   ├── markdown-parser.ts   # Markdown processing
│   │   ├── settings.ts          # Settings UI
│   │   └── types.ts             # TypeScript interfaces
│   │
│   ├── Support Modules (11 files)
│   │   ├── constants.ts         # CSS classes, timing, limits
│   │   ├── logger.ts            # Centralized logging
│   │   ├── hotkey-handler.ts    # Keyboard shortcuts
│   │   ├── word-display.ts      # Word rendering
│   │   ├── dom-registry.ts      # DOM management
│   │   ├── view-state.ts        # Reactive state
│   │   ├── breadcrumb-manager.ts # Navigation
│   │   ├── minimap-manager.ts   # Visual minimap
│   │   ├── menu-builder.ts      # Dropdown menus
│   │   ├── auto-load-manager.ts # Auto-load
│   │   └── ui-builders.ts       # UI components
│   │
│   └── Services (4 files)
│       ├── timeout-manager.ts    # Timer management
│       ├── settings-validator.ts # Validation
│       ├── micropause-service.ts # Strategy Pattern
│       └── stats-formatter.ts    # Statistics
│
├── styles.css                    # Plugin styles
├── main.ts                       # Plugin entry point
├── manifest.json                 # Plugin manifest
└── CLAUDE.md                     # Architecture docs
```

### Key Architecture Patterns

- **View-Engine Separation**: UI (rsvp-view.ts) and logic (rsvp-engine.ts) are decoupled
- **Service Pattern**: Dedicated services for specific concerns
- **Strategy Pattern**: MicropauseService uses strategies for different pause types
- **DOM Registry**: Centralized DOM element management

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## npm Scripts

- `npm run build` - Production build (TypeScript + esbuild)
- `npm run dev` - Development with watch mode
- `npm run version` - Bump version (updates manifest.json)

## Pull Request Guidelines

### Before Submitting

- [ ] Code follows TypeScript best practices
- [ ] All TypeScript compilation passes (`tsc -noEmit`)
- [ ] Obsidian plugin guidelines respected
- [ ] Documentation updated if needed
- [ ] Tested in Obsidian (manual testing)
- [ ] Build artifacts updated (`main.js`)

### PR Description Template

```markdown
## What

Brief description of changes

## Why

Reason for changes / problem solved

## How

Technical approach (if complex)

## Testing

How to test these changes

## Screenshots (if UI changes)
```

## Release Process

1. Update `manifest.json` version
2. Run `npm run build`
3. Commit including `main.js`
4. Create GitHub release with tag matching version
5. Attach `main.js`, `manifest.json`, `styles.css`

## Questions?

- **Issues**: https://github.com/inattendu/dashreader/issues
- **Discussions**: https://github.com/inattendu/dashreader/discussions
- **Architecture**: See [CLAUDE.md](CLAUDE.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
