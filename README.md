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

- **Slow start** - Gradual speed ramp over first 5 words
- **Smart micropauses** - Configurable delays for sentence punctuation (2.5x), other punctuation (1.5x), numbers (1.8x), long words (1.4x), paragraphs (2.5x)
- **Heading-aware pauses** - Proportional delays for H1 (2x), H2 (1.8x), H3 (1.5x), etc.
- **Callout-aware pauses** - Visual separator and 2x delay for Obsidian callouts
- **Progressive acceleration** - Gradual speed increase during reading session
- Default 400 WPM (comfortable range: 400-800 WPM)

### Navigation & Structure (v1.4.0)

- **Breadcrumb** - H1 › H2 › H3 path with clickable navigation and dropdown menus
- **Minimap** - Vertical progress bar with heading markers for instant jumps
- **Outline menu** (≡) - Full hierarchical document structure

### Smart Positioning

- Automatically begins reading from cursor position
- Tracks keyboard navigation in real-time
- Accurate word position calculation after markdown parsing

### Interface

- Adaptive dark/light mode (follows Obsidian theme)
- Real-time progress bar and live statistics
- Accurate time estimation including all micropauses
- Distraction-free minimal design
- Toggleable panels and inline settings

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

All settings available in `Settings → DashReader` with editable numeric inputs for precise control:

- **Reading**: WPM speed (50-5000), chunk size, font customization
- **Slow Start**: Progressive speed ramp over first 5 words
- **Acceleration**: Progressive speed increase, duration, target WPM
- **Appearance**: Colors for highlight, text, and background
- **Context Display**: Toggle context words, adjust count
- **Micropause**: Configurable multipliers for punctuation, numbers, long words, paragraphs, section markers, list bullets, callouts
- **Navigation**: Toggle breadcrumb/minimap, adjust opacity and size
- **Auto-load/Auto-start**: Automatic content loading and playback
- **Display**: Progress bar and statistics visibility

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup and guidelines
- Obsidian plugin guidelines compliance
- Project structure and architecture
- Git workflow and commit conventions
- Pull request guidelines

## License

MIT License - See LICENSE file for details

## Author

**inattendu**

For questions or suggestions:
- GitHub Issues: [inattendu/dashreader/issues](https://github.com/inattendu/dashreader/issues)

---

**Read faster. Understand better.** ⚡
