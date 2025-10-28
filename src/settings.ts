import { App, PluginSettingTab, Setting } from 'obsidian';
import DashReaderPlugin from '../main';

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
    let inputEl: HTMLInputElement;

    // Add slider
    setting.addSlider(slider => slider
      .setLimits(min, max, step)
      .setValue(value)
      .setDynamicTooltip()
      .onChange(async (newValue) => {
        inputEl.value = newValue.toString();
        await onChange(newValue);
      }));

    // Add editable input
    inputEl = setting.controlEl.createEl('input', {
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

    // Update slider when input changes
    inputEl.addEventListener('change', async () => {
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
    });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'DashReader Settings' });

    // Section: Lecture
    containerEl.createEl('h3', { text: 'Reading Settings' });

    const wpmSetting = new Setting(containerEl)
      .setName('Words per minute (WPM)')
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

    new Setting(containerEl)
      .setName('Font family')
      .setDesc('Font family for text display')
      .addDropdown(dropdown => dropdown
        .addOption('inherit', 'Default')
        .addOption('monospace', 'Monospace')
        .addOption('serif', 'Serif')
        .addOption('sans-serif', 'Sans-serif')
        .setValue(this.plugin.settings.fontFamily)
        .onChange(async (value) => {
          this.plugin.settings.fontFamily = value;
          await this.plugin.saveSettings();
        }));

    // Section: Reading Enhancements
    containerEl.createEl('h3', { text: 'Reading Enhancements' });

    new Setting(containerEl)
      .setName('Slow Start')
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
      .setName('Target WPM')
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
    containerEl.createEl('h3', { text: 'Appearance' });

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
    containerEl.createEl('h3', { text: 'Context Display' });

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

    // === Navigation Display ===
    containerEl.createEl('h3', { text: 'Navigation' });

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
    containerEl.createEl('h3', { text: 'Micropause' });

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
      .setDesc('Pause multiplier for 1., I., A., etc. (1.0-3.0)');
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
    containerEl.createEl('h3', { text: 'Auto-start' });

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
    containerEl.createEl('h3', { text: 'Display Options' });

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
    containerEl.createEl('h3', { text: 'Keyboard Shortcuts' });
    containerEl.createEl('p', {
      text: 'Note: Hotkey customization is available in Obsidian\'s Hotkeys settings.',
      cls: 'setting-item-description'
    });
  }
}
