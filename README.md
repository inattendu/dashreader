# DashReader

[![Version](https://img.shields.io/badge/version-1.4.1-blue.svg)](https://github.com/inattendu/dashreader)
[![Obsidian](https://img.shields.io/badge/Obsidian-Compatible-8b5cf6.svg)](https://obsidian.md)
[![Status](https://img.shields.io/badge/status-stable-green.svg)](https://github.com/inattendu/dashreader)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Speed reading plugin for Obsidian** using **RSVP** (Rapid Serial Visual Presentation) technique.

> 🎯 **Project Status**: Stable • Production-ready • Obsidian Guidelines Compliant

![DashReader Demo](dashreader.gif)

## What is RSVP?

**RSVP (Rapid Serial Visual Presentation)** is a speed reading technique that displays text one word at a time in the same fixed location on screen. This eliminates eye movement and allows your brain to focus entirely on comprehension, enabling reading speeds of 500-1000+ words per minute.

Instead of your eyes moving across lines of text, the text comes to you. Each word appears at the optimal focal point with the center character highlighted, maximizing reading efficiency.

## Features

### Core Reading
- Word-by-word display at screen center
- Center character highlighting for optimal focus
- Adjustable speed (50-5000 WPM) - supports ultra-fast reading speeds
- Multi-word chunks (1-5 words at a time)
- Context display (surrounding words preview)

### Intelligent Pacing
- **Slow start** - gradual speed increase over first 5 words to ease into reading
- **Smart micropauses** based on content type, punctuation, word length, and structure
  - Sentence-ending punctuation (.,!?): 2.5x delay
  - Other punctuation (;:,): 1.5x delay
  - Numbers and dates: 1.8x delay
  - Long words (>8 chars): 1.4x delay
  - Paragraph breaks: 2.5x delay
- **Heading-aware pauses** - longer pauses before H1 (2x), H2 (1.8x), H3 (1.5x), etc.
- **Callout-aware pauses** - visual separator and 2x delay for Obsidian callouts
- **Progressive acceleration** - gradually increase speed during reading session
- Default 400 WPM (comfortable range: 400-800 WPM with practice)
- All multipliers fully configurable

### Markdown Support
- Parses markdown syntax (links, bold, italic, code)
- Reads code block content
- **Obsidian callouts support** - displays with icons (📝 note, 💡 tip, ⚠️ warning, etc.)
- **Proportional heading display** - H1 displayed 1.5x larger, H2 at 1.3x, H3 at 1.2x, etc.
- Visual separators before sections

### Contextual Navigation (v1.4.0)

- **Breadcrumb navigation** - shows your position in document structure (H1 › H2 › H3)
  - Click any heading to jump to that position
  - Dropdown menus (▼) for navigating between headings of same level
    - Shows numbered list of all headings at the same level
    - Works smoothly during active reading (optimized updates)
    - Centered display with overflow protection
  - Full heading titles displayed (no truncation, word-wrapping enabled)
- Updates automatically as you read through sections (only when context changes)
- Displayed immediately on text load, not just during playback
- Callouts displayed with their respective icons in breadcrumb
- **Outline menu** (≡) - full document structure overview
  - Hierarchical view of all headings and callouts
  - Visual indentation by level
  - Current position highlighted
  - Click to jump anywhere in document
  - Auto-scroll to current position
- **New tab mode** - click ⤢ button to open in dedicated tab for fullscreen-like experience

### Visual Minimap (v1.4.0)

- **Document overview** - vertical line showing reading progress
  - Heading markers positioned proportionally to document structure
  - Visual size hierarchy: H1 (large) › H2 (medium) › H3 (small)
  - Current position indicator with smooth tracking
  - Progress fill from top to current position
- **Instant navigation** - click any heading marker to jump
- **Rich tooltips** - hover to see heading text and callout icons
- **Nearly invisible** - subtle presence, becomes visible on hover
- **Always accessible** - visible throughout reading session
- Toggle visibility via settings or toolbar button (👁)

### Smart Positioning
- **Click-to-start** - automatically begins reading from cursor position
- Tracks keyboard navigation in real-time
- Updates on cursor movement (arrows, page up/down, vim keys)
- Calculates accurate word position after markdown parsing

### Interface

- **Adaptive dark/light mode** - follows Obsidian theme
- **Real-time progress bar** - horizontal progress indicator
- **Live statistics** - words read, time elapsed, current WPM, remaining time
- **Estimated reading time** - accurate calculation including all micropauses
- **Distraction-free design** - clean, minimal interface
- **Toggleable panels** - show/hide controls and stats as needed
- **Inline settings** - quick adjustments without leaving reading view

### Keyboard Shortcuts
- `Shift+Space`: Play/Pause
- `←`: Rewind 10 words
- `→`: Forward 10 words
- `↑`: Increase WPM (+25)
- `↓`: Decrease WPM (-25)
- `Esc`: Stop
- `s`: Toggle statistics

## Installation

### From Community Plugins (coming soon)
1. Open Settings → Community plugins
2. Browse and search for "DashReader"
3. Install and enable

### Manual Installation
1. Download `main.js`, `manifest.json`, `styles.css` from the latest release
2. Create folder `.obsidian/plugins/dashreader/` in your vault
3. Copy the downloaded files to this folder
4. Reload Obsidian
5. Enable DashReader in Settings → Community plugins

## Usage

### Quick Start
1. Click the ⚡ icon in the ribbon
2. Click anywhere in your note to set reading position
3. Press `Shift+Space` to start reading

### Other Methods
- **Command palette**: `Ctrl/Cmd + P` → "Open DashReader"
- **Context menu**: Right-click selected text → "Read with DashReader"
- **Auto-load**: Opens automatically when switching notes (configurable)

## Configuration

All settings available in `Settings → DashReader`:

**Enhanced UI** (v1.4.0): All numeric settings now display editable values next to sliders for precise control

- **Reading Settings**: WPM speed (50-5000), chunk size, font size and family
- **Slow Start** (v1.4.0): Enable progressive speed ramp over first 5 words for comfortable start
- **Speed Acceleration**: Enable progressive acceleration, duration, target WPM
- **Appearance**: Highlight color, text color, background color
- **Context Display**: Show/hide context words, number of context words
- **Micropause** (v1.4.0): Enable/disable, all multipliers fully configurable:
  - Sentence punctuation (.,!?) - default 2.5x
  - Other punctuation (;:,) - default 1.5x
  - Numbers and dates - default 1.8x
  - Long words (>8 chars) - default 1.4x
  - Paragraphs - default 2.5x
  - Section markers (1., I., etc.) - default 2.0x
  - List bullets (-, *, +) - default 1.8x
  - Obsidian callouts - default 2.0x
- **Navigation Display**:
  - Show/hide breadcrumb navigation
  - Show/hide minimap
  - Minimap opacity and size controls
- **Auto-load**: Automatically load content when switching notes/cursor changes
- **Auto-start**: Enable auto-start, delay duration
- **Display Options**: Progress bar, statistics visibility

## Technology & Code Quality

**Built with TypeScript** using Obsidian Plugin API for maximum performance and integration.

### Code Quality Standards

- ✅ **100% Obsidian Guidelines Compliant** - passes all security and quality checks
- ✅ **Type-safe** - full TypeScript with strict mode
- ✅ **XSS Protection** - DOM API usage, no innerHTML with user content
- ✅ **Modular Architecture** - clean separation of concerns
- ✅ **Well-documented** - comprehensive inline documentation
- ✅ **Zero console spam** - clean console in production
- ✅ **Memory-safe** - proper cleanup and resource management

### Architecture Highlights

- **View-Engine Separation** - UI and logic decoupled
- **Service-Oriented** - dedicated services for specific concerns (4 services extracted)
- **Event-Driven** - reactive state management
- **Performance-Optimized** - efficient rendering and updates
- **Extensible** - easy to add new features
- **Type-Safe** - only 1 `as any` remaining (99% type-safe)

## Roadmap

### Current Version (1.4.1) - Stable ✅

**Features:**
- Complete RSVP reading engine
- Breadcrumb navigation with full document structure
- Visual minimap with heading markers
- Obsidian callouts support
- All micropause controls
- 100% Obsidian guidelines compliant

**Code Quality (Phase 2 Refactoring Complete):**
- ✅ Enhanced type safety (99% type-safe, only 1 `as any` remaining)
- ✅ Service extraction (4 dedicated services: timeout, settings, micropause, stats)
- ✅ Module extraction (15 focused modules vs monolithic structure)
- ✅ Simplified complexity (functions < 50 lines average)
- ✅ Performance optimizations (efficient DOM updates, optimized rendering)

### Future Features 💡

- Reading statistics and progress tracking
- Multiple document reading queues
- Export reading sessions
- Custom reading profiles
- Browser extension version

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Maintain Obsidian plugin guidelines compliance
- Add tests for new features
- Update documentation
- Keep functions small and focused

## Development

```bash
# Clone the repo to your vault's plugin folder
cd /path/to/vault/.obsidian/plugins
git clone https://github.com/inattendu/dashreader

# Install dependencies
cd dashreader
npm install

# Build for production
npm run build

# Build and watch for changes
npm run dev

# Run tests (coming soon)
npm test

# Type checking
npx tsc --noEmit
```

### Project Structure

```text
dashreader/
├── src/
│   ├── rsvp-view.ts              # Main view component
│   ├── rsvp-engine.ts            # Reading engine logic
│   ├── markdown-parser.ts        # Markdown to plain text
│   ├── word-display.ts           # Word rendering
│   ├── breadcrumb-manager.ts     # Navigation breadcrumb
│   ├── minimap-manager.ts        # Visual minimap
│   ├── menu-builder.ts           # Dropdown menus
│   ├── auto-load-manager.ts      # Auto-load functionality
│   ├── hotkey-handler.ts         # Keyboard shortcuts
│   ├── dom-registry.ts           # DOM element management
│   ├── view-state.ts             # Reactive state
│   ├── ui-builders.ts            # UI component builders
│   ├── constants.ts              # CSS classes, timing, limits
│   ├── logger.ts                 # Centralized logging
│   ├── settings.ts               # Settings tab
│   ├── types.ts                  # TypeScript interfaces
│   └── services/
│       ├── timeout-manager.ts    # Timer management
│       ├── settings-validator.ts # Settings validation
│       ├── micropause-service.ts # Micropause calculation
│       └── stats-formatter.ts    # Statistics formatting
├── styles.css                    # Plugin styles
├── main.ts                       # Plugin entry point
├── manifest.json                 # Plugin manifest
└── CLAUDE.md                     # Architecture documentation
```

### Key Commands

- `npm run build` - Production build (TypeScript + esbuild)
- `npm run dev` - Development with watch mode
- `npm run version` - Bump version (updates manifest.json)

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## License

MIT License - See LICENSE file for details

## Author

**inattendu**

For questions or suggestions:
- GitHub Issues: [inattendu/dashreader/issues](https://github.com/inattendu/dashreader/issues)

---

**Read faster. Understand better.** ⚡
