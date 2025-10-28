/**
 * Parse le Markdown pour enlever la syntaxe et garder uniquement le texte
 */
export class MarkdownParser {

  static parseToPlainText(markdown: string): string {
    let text = markdown;

    // 1. Enlever le frontmatter YAML EN PREMIER (souvent au début)
    text = text.replace(/^---[\s\S]*?---\n?/m, '');

    // 2. Protéger le contenu des blocs de code avec des marqueurs temporaires
    // Cela empêche les commentaires # dans le code d'être traités comme des headings
    const codeBlocks: string[] = [];
    text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_match, code) => {
      const index = codeBlocks.length;
      codeBlocks.push(code);
      return `___CODE_BLOCK_${index}___`;
    });

    // 3. Enlever les inline code mais garder le contenu
    text = text.replace(/`([^`]+)`/g, '$1');

    // 4. Enlever les images ![alt](url) AVANT les liens
    text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');

    // 5. Enlever les liens [texte](url) -> garder texte
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // 6. Enlever les wikilinks [[lien]] ou [[lien|alias]] -> garder alias ou lien
    text = text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (_match, link, _pipe, alias) => {
      return alias || link;
    });

    // 7. Enlever le bold/italic (dans l'ordre: **, __, *, _)
    text = text.replace(/\*\*\*([^\*]+)\*\*\*/g, '$1'); // bold+italic ***
    text = text.replace(/\*\*([^\*]+)\*\*/g, '$1'); // bold **
    text = text.replace(/__([^_]+)__/g, '$1'); // bold __
    text = text.replace(/\*([^\*\n]+)\*/g, '$1'); // italic *
    text = text.replace(/_([^_\n]+)_/g, '$1'); // italic _

    // 8. Enlever les strikethrough ~~texte~~
    text = text.replace(/~~([^~]+)~~/g, '$1');

    // 9. Enlever les highlights ==texte==
    text = text.replace(/==([^=]+)==/g, '$1');

    // 10. Marquer les headings avec leur niveau (#, ##, etc.)
    // # Titre → [H1]Titre, ## Titre → [H2]Titre, etc. (sans espace après le marqueur)
    text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_match, hashes, content) => {
      const level = hashes.length;
      return `[H${level}]${content}`;
    });

    // 11. Marquer les callouts Obsidian comme pseudo-headings
    // > [!type] Titre → [CALLOUT:type]Titre
    // Garde le contenu des lignes suivantes (gérées par l'étape suivante)
    text = text.replace(/^>\s*\[!([\w-]+)\]\s*(.*)$/gm, (_match, type, title) => {
      // Si pas de titre, utiliser le type comme titre
      const displayTitle = title.trim() || type;
      return `[CALLOUT:${type}]${displayTitle}`;
    });

    // 12. Enlever les blockquotes > (garder le contenu)
    text = text.replace(/^>\s*/gm, '');

    // 13. Enlever les listes - * + (garder juste le contenu)
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // 14. Enlever les dividers ---, ***, ___
    text = text.replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '');

    // 15. Enlever les tags/hashtags Obsidian #tag (mais pas dans les mots)
    text = text.replace(/(?:^|\s)(#[a-zA-Z0-9_/-]+)/g, '');

    // 16. Enlever les footnotes [^1]
    text = text.replace(/\[\^[^\]]+\]/g, '');

    // 17. Enlever les références de footnotes
    text = text.replace(/^\[\^[^\]]+\]:.*$/gm, '');

    // 18. Enlever les backlinks Obsidian (sections backlinks)
    text = text.replace(/^---\s*Backlinks?\s*---[\s\S]*$/m, '');
    text = text.replace(/^##?\s*Backlinks?[\s\S]*$/m, '');

    // 19. Enlever les HTML comments <!-- -->
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // 20. Enlever les balises HTML
    text = text.replace(/<[^>]+>/g, '');

    // 21. Enlever les lignes vides multiples (garder max 2 sauts de ligne)
    text = text.replace(/\n{3,}/g, '\n\n');

    // 22. Enlever les espaces en trop sur chaque ligne
    text = text.replace(/^[ \t]+/gm, '');
    text = text.replace(/[ \t]+$/gm, '');

    // 23. Restaurer le contenu des blocs de code
    text = text.replace(/___CODE_BLOCK_(\d+)___/g, (_match, index) => {
      return codeBlocks[parseInt(index)] || '';
    });

    // 24. Trim final
    text = text.trim();

    return text;
  }

  /**
   * Parse le texte sélectionné en tenant compte du contexte Obsidian
   */
  static parseSelection(text: string): string {
    return this.parseToPlainText(text);
  }
}
