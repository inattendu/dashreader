import { Plugin, WorkspaceLeaf, Notice, MarkdownView, Menu, Editor } from 'obsidian';
import { DashReaderView, VIEW_TYPE_DASHREADER } from './src/rsvp-view';
import { DashReaderSettingTab } from './src/settings';
import { DashReaderSettings } from './src/types';
import { validateSettings } from './src/services/settings-validator';

export default class DashReaderPlugin extends Plugin {
  settings: DashReaderSettings;

  async onload() {
    await this.loadSettings();

    // Enregistrer la vue
    this.registerView(
      VIEW_TYPE_DASHREADER,
      (leaf) => new DashReaderView(leaf, this.settings)
    );

    // Ajouter l'icône dans la ribbon
    this.addRibbonIcon('zap', 'Open speed reader', () => {
      void this.activateView();
    });

    // Command: Open DashReader
    this.addCommand({
      id: 'open',
      name: 'Open speed reader',
      callback: () => {
        void this.activateView();
      }
    });

    // Command: Read selected text
    this.addCommand({
      id: 'read-selection',
      name: 'Read selected text',
      editorCallback: (editor: Editor) => {
        const selection = editor.getSelection();
        if (selection) {
          void this.activateView().then(() => {
            const view = this.getView();
            if (view) {
              view.loadText(selection);
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
          void this.activateView().then(() => {
            const view = this.getView();
            if (view) {
              view.loadText(content);
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
      name: 'Toggle play/pause',
      callback: () => {
        // This command is handled by the view itself
        new Notice('Use Shift+Space key when speed reader is active');
      }
    });

    // Context menu
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
        const selection = editor.getSelection();
        if (selection) {
          menu.addItem((item) => {
            item
              .setTitle('Read with speed reader')
              .setIcon('zap')
              .onClick(() => {
                void this.activateView().then(() => {
                  const view = this.getView();
                  if (view) {
                    view.loadText(selection);
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
        const view = this.getView();
        if (view) {
          view.updateSettings(this.settings);
        }
      })
    );
  }

  onunload() {
    // Don't detach leaves here - let Obsidian restore them at original positions during updates
  }

  private getView(): DashReaderView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHREADER);
    if (leaves.length > 0) {
      return leaves[0].view as unknown as DashReaderView;
    }
    return null;
  }

  async loadSettings() {
    const rawSettings = await this.loadData() as Partial<DashReaderSettings> | null;
    this.settings = validateSettings(rawSettings);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Mettre à jour la vue si elle existe
    const view = this.getView();
    if (view) {
      view.updateSettings(this.settings);
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
      void workspace.revealLeaf(leaf);
    }
  }
}
