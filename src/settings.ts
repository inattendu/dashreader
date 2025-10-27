import { App, PluginSettingTab, Setting } from 'obsidian';
import DashReaderPlugin from '../main';

export class DashReaderSettingTab extends PluginSettingTab {
  plugin: DashReaderPlugin;

  constructor(app: App, plugin: DashReaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'DashReader Settings' });

    // Section: Lecture
    containerEl.createEl('h3', { text: 'Reading Settings' });

    new Setting(containerEl)
      .setName('Words per minute (WPM)')
      .setDesc('Reading speed (50-1000)')
      .addSlider(slider => slider
        .setLimits(50, 1000, 25)
        .setValue(this.plugin.settings.wpm)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.wpm = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Words at a time')
      .setDesc('Number of words displayed simultaneously (1-5)')
      .addSlider(slider => slider
        .setLimits(1, 5, 1)
        .setValue(this.plugin.settings.chunkSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.chunkSize = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Font size')
      .setDesc('Font size in pixels (20-120px)')
      .addSlider(slider => slider
        .setLimits(20, 120, 4)
        .setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.fontSize = value;
          await this.plugin.saveSettings();
        }));

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

    // Section: Speed Acceleration
    containerEl.createEl('h3', { text: 'Speed Acceleration' });

    new Setting(containerEl)
      .setName('Enable acceleration')
      .setDesc('Gradually increase reading speed over time')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAcceleration)
        .onChange(async (value) => {
          this.plugin.settings.enableAcceleration = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Acceleration duration')
      .setDesc('Duration to reach target speed (seconds)')
      .addSlider(slider => slider
        .setLimits(10, 120, 5)
        .setValue(this.plugin.settings.accelerationDuration)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.accelerationDuration = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Target WPM')
      .setDesc('Target reading speed to reach (50-1000)')
      .addSlider(slider => slider
        .setLimits(50, 1000, 25)
        .setValue(this.plugin.settings.accelerationTargetWpm)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.accelerationTargetWpm = value;
          await this.plugin.saveSettings();
        }));

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

    new Setting(containerEl)
      .setName('Context words')
      .setDesc('Number of context words to display (1-10)')
      .addSlider(slider => slider
        .setLimits(1, 10, 1)
        .setValue(this.plugin.settings.contextWords)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.contextWords = value;
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

    new Setting(containerEl)
      .setName('Punctuation pause')
      .setDesc('Pause multiplier for punctuation (1.0-3.0)')
      .addSlider(slider => slider
        .setLimits(1.0, 3.0, 0.1)
        .setValue(this.plugin.settings.micropausePunctuation)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.micropausePunctuation = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Long words pause')
      .setDesc('Pause multiplier for long words (1.0-2.0)')
      .addSlider(slider => slider
        .setLimits(1.0, 2.0, 0.1)
        .setValue(this.plugin.settings.micropauseLongWords)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.micropauseLongWords = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Paragraph pause')
      .setDesc('Pause multiplier for paragraph breaks (1.0-5.0)')
      .addSlider(slider => slider
        .setLimits(1.0, 5.0, 0.5)
        .setValue(this.plugin.settings.micropauseParagraph)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.micropauseParagraph = value;
          await this.plugin.saveSettings();
        }));

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

    new Setting(containerEl)
      .setName('Auto-start delay')
      .setDesc('Delay before auto-start (seconds)')
      .addSlider(slider => slider
        .setLimits(1, 10, 1)
        .setValue(this.plugin.settings.autoStartDelay)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.autoStartDelay = value;
          await this.plugin.saveSettings();
        }));

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
