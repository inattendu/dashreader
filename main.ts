import { Plugin, WorkspaceLeaf, Notice, MarkdownView, Menu, Editor } from 'obsidian';
import { DashReaderView, VIEW_TYPE_DASHREADER } from './src/rsvp-view';
import { DashReaderSettingTab } from './src/settings';
import { DashReaderSettings } from './src/types';
import { validateSettings } from './src/services/settings-validator';

export default class DashReaderPlugin extends Plugin {
  settings: DashReaderSettings;
  private view: DashReaderView | null = null;

  async onload() {
    await this.loadSettings();

    // Enregistrer la vue
    this.registerView(
      VIEW_TYPE_DASHREADER,
      (leaf) => {
        this.view = new DashReaderView(leaf, this.settings);
        return this.view;
      }
    );

    // Ajouter l'icône dans la ribbon
    this.addRibbonIcon('zap', 'Open DashReader', () => {
      this.activateView();
    });

    // Command: Open DashReader
    this.addCommand({
      id: 'open-dashreader',
      name: 'Open RSVP reader',
      callback: () => {
        this.activateView();
      }
    });

    // Command: Read selected text
    this.addCommand({
      id: 'read-selection',
      name: 'Read selected text',
      editorCallback: (editor: Editor) => {
        const selection = editor.getSelection();
        if (selection) {
          this.activateView().then(() => {
            if (this.view) {
              this.view.loadText(selection);
            }
          });
        } else {
          new Notice('Please select some text first');
        }
      }
    });

    // Command: Read entire note
    this.addCommand({
      id: 'read-note',
      name: 'Read entire note',
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
          const content = activeView.editor.getValue();
          this.activateView().then(() => {
            if (this.view) {
              this.view.loadText(content);
            }
          });
        } else {
          new Notice('No active note found');
        }
      }
    });

    // Command: Toggle Play/Pause
    this.addCommand({
      id: 'toggle-play-pause',
      name: 'Toggle Play/Pause',
      callback: () => {
        // This command is handled by the view itself
        new Notice('Use Shift+Space key when DashReader is active');
      }
    });

    // Context menu
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
        const selection = editor.getSelection();
        if (selection) {
          menu.addItem((item) => {
            item
              .setTitle('Read with DashReader')
              .setIcon('zap')
              .onClick(() => {
                this.activateView().then(() => {
                  if (this.view) {
                    this.view.loadText(selection);
                  }
                });
              });
          });
        }
      })
    );

    // Onglet de paramètres
    this.addSettingTab(new DashReaderSettingTab(this.app, this));

    // Mettre à jour la vue quand les paramètres changent
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        if (this.view) {
          this.view.updateSettings(this.settings);
        }
      })
    );
  }

  onunload() {
    // Don't detach leaves here - let Obsidian restore them at original positions during updates
  }

  async loadSettings() {
    const rawSettings = await this.loadData();
    this.settings = validateSettings(rawSettings);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Mettre à jour la vue si elle existe
    if (this.view) {
      this.view.updateSettings(this.settings);
    }
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_DASHREADER);

    if (leaves.length > 0) {
      // Une vue existe déjà, l'utiliser
      leaf = leaves[0];
    } else {
      // Créer une nouvelle vue dans le panneau de droite
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_DASHREADER,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      this.view = leaf.view as DashReaderView;
    }
  }
}
