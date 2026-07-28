import { App, PluginSettingTab, Setting } from 'obsidian';
import DashReaderPlugin from '../main';
import { getInstalledFontFamilies } from './services/font-family';

/**
 * FontFamilySuggest - Autocomplete dropdown for font selection
 *
 * Features:
 * - Filters fonts as user types
 * - Keyboard navigation (↑↓ Enter Escape)
 * - Shows preview of selected font
 * - Falls back gracefully if no fonts detected
 */
class FontFamilySuggest {
  private inputEl: HTMLInputElement;
  private suggestEl: HTMLDivElement;
  private fonts: string[] = [];
  private filteredFonts: string[] = [];
  private selectedIndex = -1;
  private isOpen = false;
  private onSelect: (value: string) => void;

  constructor(
    containerEl: HTMLElement,
    currentValue: string,
    onSelect: (value: string) => void
  ) {
    this.onSelect = onSelect;

    // Create input container
    const inputContainer = containerEl.createDiv({
      cls: 'dashreader-font-suggest-container'
    });

    // Create text input
    this.inputEl = inputContainer.createEl('input', {
      type: 'text',
      value: currentValue === 'inherit' ? '' : currentValue,
      placeholder: 'Type to search fonts...',
      cls: 'dashreader-font-suggest-input'
    });

    // Preview the current font
    if (currentValue && currentValue !== 'inherit') {
      this.inputEl.style.fontFamily = currentValue;
    }

    // Create dropdown container
    this.suggestEl = inputContainer.createDiv({
      cls: 'dashreader-font-suggest-dropdown'
    });

    // Load fonts and setup events
    void this.loadFonts();
    this.setupEvents();
  }

  private async loadFonts(): Promise<void> {
    // Add system defaults first
    this.fonts = [
      'inherit',
      'system-ui',
      'serif',
      'sans-serif',
      'monospace',
      '---', // separator
      ...await getInstalledFontFamilies()
    ];
    this.filteredFonts = this.fonts;
  }

  private setupEvents(): void {
    // Input events
    this.inputEl.addEventListener('input', () => this.onInput());
    this.inputEl.addEventListener('focus', () => this.open());
    this.inputEl.addEventListener('blur', () => {
      // Delay to allow click on dropdown
      setTimeout(() => this.close(), 150);
    });
    this.inputEl.addEventListener('keydown', (e) => this.onKeydown(e));
  }

  private onInput(): void {
    const query = this.inputEl.value.toLowerCase().trim();

    if (!query) {
      this.filteredFonts = this.fonts;
    } else {
      this.filteredFonts = this.fonts.filter(font =>
        font !== '---' && font.toLowerCase().includes(query)
      );
    }

    this.selectedIndex = -1;
    this.render();
    this.open();
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        this.open();
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.filteredFonts[this.selectedIndex]) {
          this.selectFont(this.filteredFonts[this.selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  }

  private selectNext(): void {
    let next = this.selectedIndex + 1;
    // Skip separators
    while (next < this.filteredFonts.length && this.filteredFonts[next] === '---') {
      next++;
    }
    if (next < this.filteredFonts.length) {
      this.selectedIndex = next;
      this.render();
      this.scrollToSelected();
    }
  }

  private selectPrevious(): void {
    let prev = this.selectedIndex - 1;
    // Skip separators
    while (prev >= 0 && this.filteredFonts[prev] === '---') {
      prev--;
    }
    if (prev >= 0) {
      this.selectedIndex = prev;
      this.render();
      this.scrollToSelected();
    }
  }

  private scrollToSelected(): void {
    const items = this.suggestEl.querySelectorAll('.dashreader-font-suggest-item');
    if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
      items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  private selectFont(font: string): void {
    if (font === '---') return;

    const displayValue = font === 'inherit' ? '' : font;
    this.inputEl.value = displayValue;

    // Preview the font
    if (font !== 'inherit' && font !== 'system-ui') {
      this.inputEl.style.fontFamily = font;
    } else {
      this.inputEl.style.fontFamily = '';
    }

    this.onSelect(font);
    this.close();
  }

  private open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.render();
    this.suggestEl.classList.add('is-open');
  }

  private close(): void {
    this.isOpen = false;
    this.suggestEl.classList.remove('is-open');
  }

  private render(): void {
    this.suggestEl.empty();

    const maxItems = 15;
    const itemsToShow = this.filteredFonts.slice(0, maxItems);

    itemsToShow.forEach((font, index) => {
      if (font === '---') {
        // Render separator
        this.suggestEl.createDiv({ cls: 'dashreader-font-suggest-separator' });
        return;
      }

      const item = this.suggestEl.createDiv({
        cls: 'dashreader-font-suggest-item'
      });

      if (index === this.selectedIndex) {
        item.classList.add('is-selected');
      }

      // Font name with preview
      const displayName = font === 'inherit' ? 'Default (theme)' : font;
      item.setText(displayName);

      // Apply font preview (except for generic keywords)
      if (!['inherit', 'system-ui', 'serif', 'sans-serif', 'monospace'].includes(font)) {
        item.style.fontFamily = font;
      }

      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur
        this.selectFont(font);
      });

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.render();
      });
    });

    // Show "more results" hint if truncated
    if (this.filteredFonts.length > maxItems) {
      const hint = this.suggestEl.createDiv({
        cls: 'dashreader-font-suggest-hint',
        text: `${this.filteredFonts.length - maxItems} more fonts...`
      });
    }
  }
}

export class DashReaderSettingTab extends PluginSettingTab {
  plugin: DashReaderPlugin;

  constructor(app: App, plugin: DashReaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Helper method to create a slider with an editable numeric display
   */
  private createSliderWithInput(
    setting: Setting,
    min: number,
    max: number,
    step: number,
    value: number,
    unit: string = '',
    onChange: (value: number) => Promise<void>
  ): void {
    // Add editable input first
    const inputEl = setting.controlEl.createEl('input', {
      type: 'text',
      value: value.toString(),
      cls: 'dashreader-slider-input'
    });

    // Add unit label if provided
    if (unit) {
      setting.controlEl.createSpan({
        text: unit,
        cls: 'dashreader-slider-unit'
      });
    }

    // Add slider after input is created
    setting.addSlider(slider => slider
      .setLimits(min, max, step)
      .setValue(value)
      .setDynamicTooltip()
      .onChange(async (newValue) => {
        inputEl.value = newValue.toString();
        await onChange(newValue);
      }));

    // Update slider when input changes
    inputEl.addEventListener('change', () => void (async () => {
      let newValue = parseFloat(inputEl.value);

      // Validate and clamp value
      if (isNaN(newValue)) {
        newValue = value; // Reset to current value if invalid
      } else {
        newValue = Math.max(min, Math.min(max, newValue));
        // Round to step precision
        newValue = Math.round(newValue / step) * step;
      }

      inputEl.value = newValue.toString();

      // Update slider
      const sliderEl = setting.controlEl.querySelector('input[type="range"]') as HTMLInputElement;
      if (sliderEl) {
        sliderEl.value = newValue.toString();
      }

      await onChange(newValue);
    })());
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Speed reader").setHeading();

    // Section: Lecture
    new Setting(containerEl).setName("Reading").setHeading();

    const wpmSetting = new Setting(containerEl)
      .setName('Words per minute')
      .setDesc('Reading speed (50-5000)');
    this.createSliderWithInput(
      wpmSetting,
      50, 5000, 25,
      this.plugin.settings.wpm,
      '',
      async (value) => {
        this.plugin.settings.wpm = value;
        await this.plugin.saveSettings();
      }
    );

    const chunkSetting = new Setting(containerEl)
      .setName('Words at a time')
      .setDesc('Number of words displayed simultaneously (1-5)');
    this.createSliderWithInput(
      chunkSetting,
      1, 5, 1,
      this.plugin.settings.chunkSize,
      '',
      async (value) => {
        this.plugin.settings.chunkSize = value;
        await this.plugin.saveSettings();
      }
    );

    const fontSizeSetting = new Setting(containerEl)
      .setName('Font size')
      .setDesc('Font size in pixels (20-120px)');
    this.createSliderWithInput(
      fontSizeSetting,
      20, 120, 4,
      this.plugin.settings.fontSize,
      'px',
      async (value) => {
        this.plugin.settings.fontSize = value;
        await this.plugin.saveSettings();
      }
    );

    // Font family with autocomplete suggest
    const fontSetting = new Setting(containerEl)
      .setName('Font family')
      .setDesc('Type to search system fonts, or choose a generic family');

    new FontFamilySuggest(
      fontSetting.controlEl,
      this.plugin.settings.fontFamily,
      async (value) => {
        this.plugin.settings.fontFamily = value;
        await this.plugin.saveSettings();
      }
    );

    // Section: Mobile Profile Override
    new Setting(containerEl).setName("Mobile override").setHeading();
    containerEl.createEl('p', {
      text: 'These settings override desktop values when running on iOS/Android.',
      cls: 'setting-item-description'
    });

    const mobileWpmSetting = new Setting(containerEl)
      .setName('Mobile: Words per minute')
      .setDesc('Reading speed on mobile (50-5000)');
    this.createSliderWithInput(
      mobileWpmSetting,
      50, 5000, 25,
      this.plugin.settings.mobileWpm,
      '',
      async (value) => {
        this.plugin.settings.mobileWpm = value;
        await this.plugin.saveSettings();
      }
    );

    const mobileFontSizeSetting = new Setting(containerEl)
      .setName('Mobile: Font size')
      .setDesc('Font size on mobile in pixels (20-120px)');
    this.createSliderWithInput(
      mobileFontSizeSetting,
      20, 120, 4,
      this.plugin.settings.mobileFontSize,
      'px',
      async (value) => {
        this.plugin.settings.mobileFontSize = value;
        await this.plugin.saveSettings();
      }
    );

    const mobileChunkSetting = new Setting(containerEl)
      .setName('Mobile: Words at a time')
      .setDesc('Number of words displayed on mobile (1-5)');
    this.createSliderWithInput(
      mobileChunkSetting,
      1, 5, 1,
      this.plugin.settings.mobileChunkSize,
      '',
      async (value) => {
        this.plugin.settings.mobileChunkSize = value;
        await this.plugin.saveSettings();
      }
    );

    new Setting(containerEl)
      .setName('Mobile: Show breadcrumb')
      .setDesc('Display breadcrumb navigation on mobile')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.mobileShowBreadcrumb)
        .onChange(async (value) => {
          this.plugin.settings.mobileShowBreadcrumb = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Mobile: Slow start')
      .setDesc('Enable slow start on mobile')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.mobileEnableSlowStart)
        .onChange(async (value) => {
          this.plugin.settings.mobileEnableSlowStart = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Mobile: Micropause')
      .setDesc('Enable micropause on mobile')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.mobileEnableMicropause)
        .onChange(async (value) => {
          this.plugin.settings.mobileEnableMicropause = value;
          await this.plugin.saveSettings();
        }));

    const mobileContextWordsSetting = new Setting(containerEl)
      .setName('Mobile: Context words')
      .setDesc('Number of context words on mobile (0-20)');
    this.createSliderWithInput(
      mobileContextWordsSetting,
      0, 20, 1,
      this.plugin.settings.mobileContextWords,
      '',
      async (value) => {
        this.plugin.settings.mobileContextWords = value;
        await this.plugin.saveSettings();
      }
    );

    const mobileContextFontSizeSetting = new Setting(containerEl)
      .setName('Mobile: Context font size')
      .setDesc('Font size for context text on mobile (10-32 px)');
    this.createSliderWithInput(
      mobileContextFontSizeSetting,
      10, 32, 1,
      this.plugin.settings.mobileContextFontSize,
      'px',
      async (value) => {
        this.plugin.settings.mobileContextFontSize = value;
        await this.plugin.saveSettings();
      }
    );

    // Section: Reading Enhancements
    new Setting(containerEl).setName("Reading enhancements").setHeading();

    new Setting(containerEl)
      .setName('Slow start')
      .setDesc('Gradually increase speed over first 5 words for comfortable start')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableSlowStart)
        .onChange(async (value) => {
          this.plugin.settings.enableSlowStart = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable acceleration')
      .setDesc('Gradually increase reading speed over time')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAcceleration)
        .onChange(async (value) => {
          this.plugin.settings.enableAcceleration = value;
          await this.plugin.saveSettings();
        }));

    const accelDurationSetting = new Setting(containerEl)
      .setName('Acceleration duration')
      .setDesc('Duration to reach target speed (seconds)');
    this.createSliderWithInput(
      accelDurationSetting,
      10, 120, 5,
      this.plugin.settings.accelerationDuration,
      's',
      async (value) => {
        this.plugin.settings.accelerationDuration = value;
        await this.plugin.saveSettings();
      }
    );

    const accelTargetSetting = new Setting(containerEl)
      .setName('Target wpm')
      .setDesc('Target reading speed to reach (50-5000)');
    this.createSliderWithInput(
      accelTargetSetting,
      50, 5000, 25,
      this.plugin.settings.accelerationTargetWpm,
      '',
      async (value) => {
        this.plugin.settings.accelerationTargetWpm = value;
        await this.plugin.saveSettings();
      }
    );

    // Section: Apparence
    new Setting(containerEl).setName("Appearance").setHeading();

    new Setting(containerEl)
      .setName('Highlight color')
      .setDesc('Color for the center character highlight')
      .addText(text => text
        .setPlaceholder('#4a9eff')
        .setValue(this.plugin.settings.highlightColor)
        .onChange(async (value) => {
          this.plugin.settings.highlightColor = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Font color')
      .setDesc('Text color')
      .addText(text => text
        .setPlaceholder('#ffffff')
        .setValue(this.plugin.settings.fontColor)
        .onChange(async (value) => {
          this.plugin.settings.fontColor = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Background color')
      .setDesc('Background color')
      .addText(text => text
        .setPlaceholder('#1e1e1e')
        .setValue(this.plugin.settings.backgroundColor)
        .onChange(async (value) => {
          this.plugin.settings.backgroundColor = value;
          await this.plugin.saveSettings();
        }));

    // Section: Context
    new Setting(containerEl).setName("Context display").setHeading();

    new Setting(containerEl)
      .setName('Show context')
      .setDesc('Display words before and after current word')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showContext)
        .onChange(async (value) => {
          this.plugin.settings.showContext = value;
          await this.plugin.saveSettings();
        }));

    const contextSetting = new Setting(containerEl)
      .setName('Context words')
      .setDesc('Number of context words to display (1-10)');
    this.createSliderWithInput(
      contextSetting,
      1, 10, 1,
      this.plugin.settings.contextWords,
      '',
      async (value) => {
        this.plugin.settings.contextWords = value;
        await this.plugin.saveSettings();
      }
    );

    const contextFontSizeSetting = new Setting(containerEl)
      .setName('Context font size')
      .setDesc('Font size for context text (10-32 px)');
    this.createSliderWithInput(
      contextFontSizeSetting,
      10, 32, 1,
      this.plugin.settings.contextFontSize,
      'px',
      async (value) => {
        this.plugin.settings.contextFontSize = value;
        await this.plugin.saveSettings();
      }
    );

    const minTokenFontSizeSetting = new Setting(containerEl)
      .setName('Minimum token font size')
      .setDesc('Minimum font size for long words that need shrinking (8-48 px)');
    this.createSliderWithInput(
      minTokenFontSizeSetting,
      8, 48, 1,
      this.plugin.settings.minTokenFontSize,
      'px',
      async (value) => {
        this.plugin.settings.minTokenFontSize = value;
        await this.plugin.saveSettings();
      }
    );

    new Setting(containerEl)
      .setName('Show focus bars')
      .setDesc('Display Reedy-style horizontal bars and vertical ORP indicator for enhanced focus')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showFocusBars)
        .onChange(async (value) => {
          this.plugin.settings.showFocusBars = value;
          await this.plugin.saveSettings();
        }));

    // === Navigation Display ===
    new Setting(containerEl).setName("Navigation").setHeading();

    new Setting(containerEl)
      .setName('Show minimap')
      .setDesc('Display vertical minimap with document structure and progress')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showMinimap)
        .onChange(async (value) => {
          this.plugin.settings.showMinimap = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show breadcrumb')
      .setDesc('Display breadcrumb navigation at the top')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showBreadcrumb)
        .onChange(async (value) => {
          this.plugin.settings.showBreadcrumb = value;
          await this.plugin.saveSettings();
        }));

    // Section: Micropause
    new Setting(containerEl).setName("Micropause").setHeading();

    new Setting(containerEl)
      .setName('Enable micropause')
      .setDesc('Automatic pauses based on punctuation and word length')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableMicropause)
        .onChange(async (value) => {
          this.plugin.settings.enableMicropause = value;
          await this.plugin.saveSettings();
        }));

    const punctuationSetting = new Setting(containerEl)
      .setName('Sentence-ending punctuation pause')
      .setDesc('Pause multiplier for .,!? (1.0-3.0)');
    this.createSliderWithInput(
      punctuationSetting,
      1.0, 3.0, 0.1,
      this.plugin.settings.micropausePunctuation,
      'x',
      async (value) => {
        this.plugin.settings.micropausePunctuation = value;
        await this.plugin.saveSettings();
      }
    );

    const otherPunctuationSetting = new Setting(containerEl)
      .setName('Other punctuation pause')
      .setDesc('Pause multiplier for ;:, (1.0-3.0)');
    this.createSliderWithInput(
      otherPunctuationSetting,
      1.0, 3.0, 0.1,
      this.plugin.settings.micropauseOtherPunctuation,
      'x',
      async (value) => {
        this.plugin.settings.micropauseOtherPunctuation = value;
        await this.plugin.saveSettings();
      }
    );

    const longWordsSetting = new Setting(containerEl)
      .setName('Long words pause')
      .setDesc('Pause multiplier for long words >8 chars (1.0-2.0)');
    this.createSliderWithInput(
      longWordsSetting,
      1.0, 2.0, 0.1,
      this.plugin.settings.micropauseLongWords,
      'x',
      async (value) => {
        this.plugin.settings.micropauseLongWords = value;
        await this.plugin.saveSettings();
      }
    );

    const paragraphSetting = new Setting(containerEl)
      .setName('Paragraph pause')
      .setDesc('Pause multiplier for paragraph breaks (1.0-5.0)');
    this.createSliderWithInput(
      paragraphSetting,
      1.0, 5.0, 0.1,
      this.plugin.settings.micropauseParagraph,
      'x',
      async (value) => {
        this.plugin.settings.micropauseParagraph = value;
        await this.plugin.saveSettings();
      }
    );

    const numbersSetting = new Setting(containerEl)
      .setName('Numbers pause')
      .setDesc('Pause multiplier for numbers and dates (1.0-3.0)');
    this.createSliderWithInput(
      numbersSetting,
      1.0, 3.0, 0.1,
      this.plugin.settings.micropauseNumbers,
      'x',
      async (value) => {
        this.plugin.settings.micropauseNumbers = value;
        await this.plugin.saveSettings();
      }
    );

    const sectionMarkersSetting = new Setting(containerEl)
      .setName('Section markers pause')
      .setDesc('Pause multiplier for 1., i., a., etc. (1.0-3.0)');
    this.createSliderWithInput(
      sectionMarkersSetting,
      1.0, 3.0, 0.1,
      this.plugin.settings.micropauseSectionMarkers,
      'x',
      async (value) => {
        this.plugin.settings.micropauseSectionMarkers = value;
        await this.plugin.saveSettings();
      }
    );

    const listBulletsSetting = new Setting(containerEl)
      .setName('List bullets pause')
      .setDesc('Pause multiplier for -, *, +, • (1.0-3.0)');
    this.createSliderWithInput(
      listBulletsSetting,
      1.0, 3.0, 0.1,
      this.plugin.settings.micropauseListBullets,
      'x',
      async (value) => {
        this.plugin.settings.micropauseListBullets = value;
        await this.plugin.saveSettings();
      }
    );

    const calloutsSetting = new Setting(containerEl)
      .setName('Callouts pause')
      .setDesc('Pause multiplier for Obsidian callouts (1.0-3.0)');
    this.createSliderWithInput(
      calloutsSetting,
      1.0, 3.0, 0.1,
      this.plugin.settings.micropauseCallouts,
      'x',
      async (value) => {
        this.plugin.settings.micropauseCallouts = value;
        await this.plugin.saveSettings();
      }
    );

    // Section: Auto-start
    new Setting(containerEl).setName("Auto-start").setHeading();

    new Setting(containerEl)
      .setName('Auto-start reading')
      .setDesc('Automatically start reading after text loads')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoStart)
        .onChange(async (value) => {
          this.plugin.settings.autoStart = value;
          await this.plugin.saveSettings();
        }));

    const autoStartDelaySetting = new Setting(containerEl)
      .setName('Auto-start delay')
      .setDesc('Delay before auto-start (seconds)');
    this.createSliderWithInput(
      autoStartDelaySetting,
      1, 10, 1,
      this.plugin.settings.autoStartDelay,
      's',
      async (value) => {
        this.plugin.settings.autoStartDelay = value;
        await this.plugin.saveSettings();
      }
    );

    // Section: Display
    new Setting(containerEl).setName("Display").setHeading();

    new Setting(containerEl)
      .setName('Show progress bar')
      .setDesc('Display reading progress bar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showProgress)
        .onChange(async (value) => {
          this.plugin.settings.showProgress = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show statistics')
      .setDesc('Display reading statistics')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showStats)
        .onChange(async (value) => {
          this.plugin.settings.showStats = value;
          await this.plugin.saveSettings();
        }));

    // Section: Hotkeys
    new Setting(containerEl).setName("Keyboard shortcuts").setHeading();
    containerEl.createEl('p', {
      text: 'Note: hotkey customization is available in Obsidian\'s hotkeys settings.',
      cls: 'setting-item-description'
    });
  }
}
