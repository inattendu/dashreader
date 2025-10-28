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

**Core Architecture** (6 main files):

- **main.ts** - Plugin entry point, registers commands, ribbon icons, and manages view lifecycle
- **src/rsvp-view.ts** - UI layer (ItemView), handles user interactions, cursor tracking, and display
- **src/rsvp-engine.ts** - Core reading engine, controls timing, word iteration, and micropause logic
- **src/markdown-parser.ts** - Transforms Markdown to plain text while marking headings with `[H1]`, `[H2]` etc.
- **src/settings.ts** - Settings UI using Obsidian's PluginSettingTab
- **src/types.ts** - Shared interfaces and default settings

**Support Modules** (extracted during refactoring Phase 2):

- **src/constants.ts** - Centralized CSS classes, timing values, limits, and magic numbers
- **src/logger.ts** - Centralized logging with DashReader: prefix
- **src/hotkey-handler.ts** - Keyboard event handling (Shift+Space, navigation hotkeys)
- **src/word-display.ts** - Word rendering logic with heading/callout support
- **src/dom-registry.ts** - DOM element management and lifecycle
- **src/view-state.ts** - Reactive state management with change tracking
- **src/breadcrumb-manager.ts** - Breadcrumb navigation UI and logic
- **src/minimap-manager.ts** - Vertical minimap visualization
- **src/menu-builder.ts** - Dropdown menu creation for navigation
- **src/auto-load-manager.ts** - Auto-load text from editor on file-open/selection
- **src/ui-builders.ts** - UI component builders (buttons, sliders, toggles)

**Services** (business logic extraction):

- **src/services/timeout-manager.ts** - Timer management with cleanup
- **src/services/settings-validator.ts** - Settings validation and sanitization
- **src/services/micropause-service.ts** - Micropause calculation using Strategy Pattern
- **src/services/stats-formatter.ts** - Statistics formatting (time, WPM, progress)

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
- View detects markers and displays with proportional font size (H1=1.5x, H2=1.3x, H3=1.2x, etc.)
- View adds visual separator lines before headings
- Engine applies longer micropauses (H1=2.0x, H2=1.8x, H3=1.5x, etc.)
- Headings extracted with full titles using line break markers (§§LINEBREAK§§)

**Breadcrumb Navigation System** (v1.4.0): Provides document structure awareness and navigation:

- **Display**: Single-line breadcrumb showing hierarchical path: 📑 H1 › H2 › H3 ▼
- **Extraction**: Engine's `extractHeadings()` collects all headings and callouts during `setText()`
  - Stops at §§LINEBREAK§§ markers to capture complete titles
  - Returns `HeadingInfo[]` with level, text, wordIndex, and optional calloutType
- **Context Building**: `getCurrentHeadingContext()` builds hierarchical breadcrumb
  - Filters headings up to current word index
  - Maintains heading stack, pops when level decreases
  - Returns `HeadingContext` with breadcrumb array and current heading
- **Navigation**: Click heading to jump, click ▼ dropdown for same-level navigation
  - `navigateToHeading(wordIndex)` preserves playback state
  - Dropdown menu shows all headings of same level with numbering
  - Menu created in `document.body` with fixed positioning for proper display
  - Centered under breadcrumb with viewport overflow protection
- **Initial Display**: Breadcrumb shown immediately on `loadText()`, not just during playback
- **Update Optimization**: Breadcrumb only redraws when heading context changes
  - `lastHeadingContext` property caches previous context
  - `hasHeadingContextChanged()` compares new vs old context
  - Prevents DOM recreation on every word, keeps dropdown clickable during reading

**Callout Support** (v1.4.0): Full integration with Obsidian callouts:
- Parser marks callouts: `> [!type] Title` → `[CALLOUT:type]Title`
- Treated as pseudo-headings (level=0) in breadcrumb hierarchy
- Display with icon prefix (📝 note, 💡 tip, ⚠️ warning, etc.)
- Visual separator and 1.2x font size during reading
- 2.0x micropause multiplier (configurable)

**Line Break Preservation** (v1.4.0): Critical for heading extraction:

- `\n` replaced with `§§LINEBREAK§§` marker in `rsvp-engine.ts` `setText()` method (not in parser)
- Allows `extractHeadings()` to detect end of single-line headings
- Markers converted back to `\n` after extraction for display
- Prevents headings from capturing following paragraphs

**Slow Start Feature** (v1.4.0): Progressive speed ramp for comfortable reading initiation:
- Enabled by default via `enableSlowStart` setting
- Multiplies delay over first 5 words: 2.0x → 1.8x → 1.6x → 1.4x → 1.2x → 1.0x
- Resets on each new reading session (play after stop/reset)
- Inspired by Stutter plugin's ease-in approach

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

**Enhanced Settings UI** (v1.4.0):
- **Editable Numeric Inputs**: All sliders now have editable text inputs displaying current values
  - Bidirectional sync: slider ↔ input
  - Validation and clamping to min/max bounds
  - Unit labels (px, s, x) displayed but non-editable
  - Implementation via `createSliderWithInput()` helper method
- **Extended WPM Range**: Max WPM increased from 1000 to 5000 for ultra-fast reading
- **Complete Micropause Controls**: All 8 micropause multipliers exposed in settings tab
  - Sentence-ending punctuation (.,!?)
  - Other punctuation (;:,)
  - Numbers and dates
  - Long words (>8 chars)
  - Paragraph breaks
  - Section markers (1., I., etc.)
  - List bullets (-, *, +, •)
  - Obsidian callouts

### Micropause System

Micropauses multiply the base delay (`60/WPM * 1000 ms`). Multiple conditions can stack multiplicatively. **All multipliers are configurable in settings** (v1.4.0):

```typescript
// Example: H1 heading with sentence-ending punctuation and long word
multiplier = 2.0 (H1) * 2.5 (.) * 1.4 (>8 chars) = 7.0x delay
```

**Configurable Multipliers** (v1.4.0):
- `micropausePunctuation` (2.5x): Sentence-ending punctuation (.,!?)
- `micropauseOtherPunctuation` (1.5x): Other punctuation (;:,)
- `micropauseNumbers` (1.8x): Words containing digits (dates, statistics, years)
- `micropauseLongWords` (1.4x): Words >8 characters
- `micropauseParagraph` (2.5x): Paragraph breaks (\n)
- `micropauseSectionMarkers` (2.0x): Section numbers (1., I., II., a., etc.)
- `micropauseListBullets` (1.8x): List bullets (-, *, +, •)
- `micropauseCallouts` (2.0x): Obsidian callouts ([CALLOUT:type])

**Heading Multipliers** (hardcoded in engine):
- H1: 2.0x, H2: 1.8x, H3: 1.5x, H4: 1.3x, H5: 1.2x, H6: 1.1x

Order of detection in `calculateDelay()`:
1. Headings (`[H1]` through `[H6]`) - engine hardcoded
2. Callouts (`[CALLOUT:type]`) - `micropauseCallouts`
3. Section markers (1., I., etc.) - `micropauseSectionMarkers`
4. List bullets (-, *, +, •) - `micropauseListBullets`
5. Sentence punctuation (.,!?) - `micropausePunctuation`
6. Other punctuation (;:,) - `micropauseOtherPunctuation`
7. Numbers (containing digits) - `micropauseNumbers`
8. Long words (>8 characters) - `micropauseLongWords`
9. Paragraph breaks (`\n`) - `micropauseParagraph`

**Stutter-Inspired Defaults** (v1.4.0):
- Base WPM: 400 (up from 300)
- Sentence punctuation: 2.5x (up from 1.5x)
- Numbers: 1.8x (new feature)
- Punctuation distinction: sentences vs. commas/semicolons

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

## Obsidian Plugin Guidelines (CRITICAL)

These guidelines from https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines MUST be followed to pass review.

### Security (CRITICAL - Will fail review)

**❌ NEVER use innerHTML/outerHTML with user input**
- User notes can contain `<script>` tags that will execute
- Always escape HTML or use DOM API (`createEl()`, `createDiv()`, `createSpan()`)
- Bad: `el.innerHTML = userText`
- Good: `el.textContent = userText` or escape HTML first

**Example - Escaping HTML:**
```typescript
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#039;');
}
```

### Resource Management (CRITICAL)

**❌ DO NOT call `detachLeavesOfType()` in `onunload()`**
- Prevents Obsidian from restoring leaf positions during plugin updates
- Leaves will be reinitialized automatically at their original position
- Simply remove the line from `onunload()`

### Styling (Required for consistency)

**❌ Avoid hardcoded inline styles**
- Bad: `el.style.color = 'red'`
- Good: Use CSS classes and CSS variables
```typescript
el.addCls('warning-text');
// In CSS: .warning-text { color: var(--text-error); }
```

**❌ No inline styles in innerHTML**
- Bad: `<div style="color: red">`
- Good: `<div class="warning-text">`

### Logging (Best practice)

**Minimize console.log() usage**
- Remove debug logs before release
- Keep only error logs: `console.error()`
- The console should be clean by default

### DOM Manipulation

**Use Obsidian helper functions**
- `containerEl.createEl()` - Create any element
- `containerEl.createDiv()` - Create div
- `containerEl.createSpan()` - Create span
- `el.empty()` - Clear element contents
- Never use `innerHTML` for user content

### UI Text

**Use sentence case, not Title Case**
- Good: "Template folder location"
- Bad: "Template Folder Location"

**Use `setHeading()` instead of HTML headings**
```typescript
new Setting(containerEl).setName('Section name').setHeading();
```

### App Instance

**Use `this.app`, never `window.app`**
- The global `app` is for debugging only
- Always use the reference from your plugin: `this.app`

### TypeScript

**Prefer `const` and `let` over `var`**
- `var` is obsolete in modern JavaScript

**Prefer `async/await` over Promises**
- More readable than `.then()` chains
