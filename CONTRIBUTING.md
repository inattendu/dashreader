# Contributing to DashReader

Contributions are welcome! This guide will help you set up your development environment and understand the project architecture.

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- npm
- Obsidian (for testing)

### Installation

```bash
# Clone the repo to your vault's plugin folder
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/inattendu/dashreader
cd dashreader

# Install dependencies
npm install

# Build for production
npm run build

# Or build with watch mode for development
npm run dev
```

### Testing in Obsidian

```bash
# Option 1: Use install script (creates symlink)
./install-local.sh /path/to/vault

# Option 2: Manual copy after build
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/dashreader/

# Reload Obsidian
# macOS: Cmd+R
# Windows/Linux: Ctrl+R
```

## Obsidian Plugin Guidelines (CRITICAL)

These guidelines from [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) **MUST** be followed. Violations will cause the plugin to fail review.

### 1. Security (CRITICAL - Will fail review)

**❌ NEVER use innerHTML/outerHTML with user input**
- User notes can contain `<script>` tags that will execute
- Always escape HTML or use DOM API: `createEl()`, `createDiv()`, `createSpan()`
- Bad: `el.innerHTML = userText`
- Good: `el.textContent = userText`

Example for HTML escaping when necessary:
```typescript
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#039;');
}
```

### 2. Resource Management (CRITICAL)

**❌ DO NOT call `detachLeavesOfType()` in `onunload()`**
- Prevents Obsidian from restoring leaf positions during plugin updates
- Leaves will be reinitialized automatically at their original position

### 3. Styling (Required for consistency)

**Prefer CSS classes over inline styles**
- Bad: `el.style.color = 'red'`
- Good: Use CSS classes and CSS variables
```typescript
el.addCls('warning-text');
// In CSS: .warning-text { color: var(--text-error); }
```

**Use `toggleClass()` for visibility**
- Bad: `el.style.display = 'none'`
- Good: `el.toggleClass('hidden', shouldHide)`

### 4. Logging (Best practice)

**Minimize console output**
- Remove debug logs before release
- Keep only error logs: `console.error()`
- The console should be clean by default

### 5. DOM Manipulation

**Use Obsidian helper functions**
```typescript
containerEl.createEl('div', { cls: 'my-class' })
containerEl.createDiv({ cls: 'my-div' })
containerEl.createSpan({ text: 'My text' })
el.empty() // Clear element contents
```

### 6. UI Text

**Use sentence case, not Title Case**
- Good: "Template folder location"
- Bad: "Template Folder Location"

**Use `setHeading()` for settings sections**
```typescript
new Setting(containerEl).setName('Section name').setHeading();
```

### 7. App Instance

**Use `this.app`, never `window.app`**
- The global `app` is for debugging only
- Always use the reference from your plugin

## Git Workflow

### Branching Strategy

- `main` - Stable releases only
- `refactor/*` - Major refactoring work
- `feature/*` - New features
- `fix/*` - Bug fixes

### Commit Messages

Follow conventional commits:
```
feat: Add new feature
fix: Fix bug
refactor: Code refactoring
docs: Documentation changes
style: Code style changes (formatting)
test: Add or update tests
chore: Maintenance tasks
```

Examples:
```bash
git commit -m "feat: Add minimap navigation"
git commit -m "fix: Correct cursor position tracking"
git commit -m "refactor(phase2): Extract MicropauseService"
git commit -m "docs: Update CLAUDE.md architecture section"
```

## Project Structure

```text
dashreader/
├── main.ts                       # Plugin entry point
├── manifest.json                 # Plugin manifest
├── versions.json                 # Version compatibility
├── styles.css                    # Plugin styles
├── CLAUDE.md                     # Architecture documentation
├── src/
│   ├── Core Architecture (6 files)
│   ├── rsvp-view.ts              # UI layer (ItemView)
│   ├── rsvp-engine.ts            # Reading engine logic
│   ├── markdown-parser.ts        # Markdown to plain text
│   ├── settings.ts               # Settings UI
│   ├── types.ts                  # TypeScript interfaces
│   │
│   ├── Support Modules (11 files)
│   ├── constants.ts              # CSS classes, timing, limits
│   ├── logger.ts                 # Centralized logging
│   ├── hotkey-handler.ts         # Keyboard shortcuts
│   ├── word-display.ts           # Word rendering logic
│   ├── dom-registry.ts           # DOM element management
│   ├── view-state.ts             # Reactive state management
│   ├── breadcrumb-manager.ts     # Navigation breadcrumb
│   ├── minimap-manager.ts        # Visual minimap
│   ├── menu-builder.ts           # Dropdown menus
│   ├── auto-load-manager.ts      # Auto-load functionality
│   ├── ui-builders.ts            # UI component builders
│   │
│   └── services/                 # Business logic services (4 files)
│       ├── timeout-manager.ts    # Timer lifecycle management
│       ├── settings-validator.ts # Settings validation & clamping
│       ├── micropause-service.ts # Micropause calculation (Strategy Pattern)
│       └── stats-formatter.ts    # Statistics formatting
```

## Architecture Patterns

### View-Engine Separation

**View** ([rsvp-view.ts](src/rsvp-view.ts)) owns UI and events:
- User interactions
- DOM rendering
- Cursor tracking
- Display updates

**Engine** ([rsvp-engine.ts](src/rsvp-engine.ts)) owns reading logic:
- Word iteration
- Timing control
- Micropause calculation
- Progress tracking

Communication:
- View → Engine: `setText()`, `play()`, `pause()`, `updateSettings()`
- Engine → View: `onWordChange()`, `onComplete()` callbacks

### Service Pattern

Dedicated services for specific concerns:
- **TimeoutManager** - Timer lifecycle (prevent memory leaks)
- **SettingsValidator** - Settings validation and clamping
- **MicropauseService** - Pause calculation (Strategy Pattern)
- **StatsFormatter** - Statistics formatting

### Strategy Pattern

**MicropauseService** implements Strategy Pattern for micropause types:
```typescript
interface MicropauseStrategy {
  matches(word: string): boolean;
  getMultiplier(settings: DashReaderSettings): number;
}

// Strategies: Punctuation, Numbers, LongWords, Paragraphs, etc.
```

## Code Conventions

### TypeScript

- Use `const` and `let`, never `var`
- Prefer `async/await` over Promises
- Enable strict mode
- Minimize `as any` casts (currently only 1 in entire codebase)

### Console Logging

- Prefix with `DashReader:` for easy filtering
- Remove debug logs before release
- Use centralized [logger.ts](src/logger.ts)

### Word Index vs Position

- Always use **word index** (count) after parsing
- Never character position from raw text
- Parse Markdown FIRST, then count words

### Event Throttling

- Cursor tracking: 150ms throttle (balance responsiveness/performance)
- Use Obsidian's debounce utilities when appropriate

### Styling

- Use CSS variables for theme compatibility
- Examples: `var(--text-muted)`, `var(--background-primary)`
- Never hardcode colors

## npm Scripts

```bash
# Development with watch mode
npm run dev

# Production build (TypeScript check + esbuild)
npm run build

# Version bump (updates manifest.json and versions.json)
npm run version

# Type checking only
npx tsc --noEmit
```

**Important**: The build output `main.js` MUST be tracked in git for Obsidian plugin releases.

## Release Process

For Obsidian plugin submission:

1. **Update version** in `manifest.json` (must match git tag, no `v` prefix)
2. **Run build**: `npm run build`
3. **Commit changes** including `main.js`:
   ```bash
   git add main.js manifest.json versions.json
   git commit -m "chore: Release v1.x.x"
   ```
4. **Create GitHub release** with tag matching manifest version (e.g., `1.4.1`)
5. **Attach files** as binary assets: `main.js`, `manifest.json`, `styles.css`

The `manifest.json` at repo root is used by Obsidian to check version. Actual files are fetched from GitHub release assets.

## Pull Request Guidelines

### Before Submitting

- Run `npm run build` and verify it succeeds
- Test in actual Obsidian vault
- Verify Obsidian plugin guidelines compliance
- Update documentation if needed
- Check console for errors/warnings

### PR Template

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation

## Testing
How the changes were tested

## Checklist
- [ ] Code follows project conventions
- [ ] Obsidian guidelines compliant
- [ ] No console.log() spam
- [ ] Documentation updated
- [ ] Build succeeds
```

## Questions?

- Check [CLAUDE.md](CLAUDE.md) for architecture details
- Open an issue for questions or suggestions
- Review existing code for examples

---

**Thank you for contributing to DashReader!** ⚡
