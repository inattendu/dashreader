# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Development with watch mode
npm run dev

# Production build (runs TypeScript check + esbuild)
npm run build

# Version bump (updates manifest.json and versions.json)
npm run version
```

**Important**: The build output `main.js` MUST be tracked in git for Obsidian plugin releases. It's intentionally not in .gitignore.

## Architecture Overview

### Plugin Structure

DashReader is an Obsidian plugin implementing RSVP (Rapid Serial Visual Presentation) speed reading. The architecture follows a clear separation:

- **main.ts** - Plugin entry point, registers commands, ribbon icons, and manages view lifecycle
- **src/rsvp-view.ts** - UI layer (ItemView), handles user interactions, cursor tracking, and display
- **src/rsvp-engine.ts** - Core reading engine, controls timing, word iteration, and micropause logic
- **src/markdown-parser.ts** - Transforms Markdown to plain text while marking headings with `[H1]`, `[H2]` etc.
- **src/settings.ts** - Settings UI using Obsidian's PluginSettingTab
- **src/types.ts** - Shared interfaces and default settings

### Key Architecture Patterns

**View-Engine Separation**: The view (`rsvp-view.ts`) owns the UI and event handling, while the engine (`rsvp-engine.ts`) owns reading logic and timing. They communicate via:
- View → Engine: `setText()`, `play()`, `pause()`, `updateSettings()`
- Engine → View: `onWordChange` callback, `onComplete` callback

**Cursor Position Tracking**: When loading text from the editor:
1. Parse Markdown FIRST to remove syntax (`markdown-parser.ts`)
2. Parse text up to cursor position separately
3. Count words in parsed text (not raw Markdown with frontmatter)
4. Pass word INDEX to engine, not character position

**Heading System**: Headings are marked during parsing (`# Title` → `[H1]Title`), then:
- View detects markers and displays with proportional font size (H1=2x, H2=1.75x, etc.)
- View adds visual separator lines before headings
- Engine applies longer micropauses (H1=3x, H2=2.5x, etc.)

**Accurate Time Estimation**: `getEstimatedDuration()` and `getRemainingTime()` iterate through ALL remaining words and sum their individual delays, accounting for:
- Heading micropauses
- Punctuation pauses
- Long word pauses
- Section markers (numbers, bullets)
- Progressive acceleration (average of start and target WPM)

### Markdown Parsing Order

The parser (`markdown-parser.ts`) processes in this specific order:
1. Extract frontmatter (remove it entirely)
2. Extract code blocks (keep content, remove delimiters)
3. Mark headings with level tags
4. Remove formatting (bold, italic, highlights)
5. Process links (keep text, remove URLs)
6. Handle callouts
7. Clean up extra whitespace

**Critical**: Always parse BEFORE counting words for cursor positioning.

### Obsidian Integration Points

- **View Type**: Custom ItemView with `VIEW_TYPE_DASHREADER = 'dashreader-view'`
- **Leaf Management**: View is activated via `this.app.workspace.getRightLeaf(false)`
- **Editor Events**: Listens to `active-leaf-change`, `file-open`, `mouseup`, `keyup` with throttling
- **Context Menu**: Adds "Read with DashReader" when text is selected

### Hotkey System

**Important**: Only `Shift+Space` triggers play/pause (not Space alone). This prevents capturing Space when typing in notes.

Other hotkeys from settings:
- `hotkeyRewind/hotkeyForward` - Navigation
- `hotkeyIncrementWpm/hotkeyDecrementWpm` - Speed control
- `hotkeyQuit` - Stop reading

### Settings Architecture

Settings are defined in `src/types.ts` as:
- Interface: `DashReaderSettings`
- Defaults: `DEFAULT_SETTINGS` const

UI is built in `src/settings.ts` using Obsidian's Setting API. Inline settings in the view mirror the main settings tab.

### Micropause System

Micropauses multiply the base delay (`60/WPM * 1000 ms`). Multiple conditions can stack multiplicatively:

```typescript
// Example: H1 heading with period and long word
multiplier = 3.0 (H1) * 1.5 (period) * 1.3 (>8 chars) = 5.85x delay
```

Order of detection in `calculateDelay()`:
1. Headings (`[H1]` through `[H6]`)
2. Section markers (1., I., etc.)
3. List bullets (-, *, +, •)
4. Punctuation (end of word)
5. Long words (>8 characters)
6. Paragraph breaks (`\n`)

## Release Process

For Obsidian plugin submission:

1. Update `manifest.json` version (must match git tag exactly, no `v` prefix)
2. Run `npm run build`
3. Commit changes including `main.js`
4. Create GitHub release with tag matching manifest version (e.g. `1.3.0`)
5. Attach `main.js`, `manifest.json`, `styles.css` as binary assets to the release

The manifest.json at repo root is used by Obsidian to check version. Actual files are fetched from GitHub release assets.

## Testing in Obsidian

```bash
# Install in vault (creates symlink)
./install-local.sh /path/to/vault

# Or manually copy after build
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/dashreader/

# Reload Obsidian
# macOS: Cmd+R
# Windows/Linux: Ctrl+R
```

## Code Conventions

- **Console logging**: Prefix with `DashReader:` for easy filtering
- **Word index vs position**: Always use word index (count) after parsing, never character position from raw text
- **Event throttling**: Cursor tracking uses 150ms throttle to balance responsiveness and performance
- **Styling**: Use CSS variables for theme compatibility (`var(--text-muted)`, etc.)
