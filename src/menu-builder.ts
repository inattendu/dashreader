/**
 * MenuBuilder - Creates and manages dropdown menus
 *
 * Factorizes common menu functionality:
 * - Menu creation with proper positioning
 * - Item rendering with indentation
 * - Click handlers and navigation
 * - Outside click detection for closing
 */

export interface MenuItem {
  text: string;
  wordIndex: number;
  level?: number;
  isCurrent?: boolean;
}

export interface MenuOptions {
  anchorEl: HTMLElement;
  cssClass: string;
  title?: string;
  items: MenuItem[];
  onItemClick: (wordIndex: number) => void;
  showLevel?: boolean;
  indentByLevel?: boolean;
}

export class MenuBuilder {
  /**
   * Creates a dropdown menu near an anchor element
   *
   * @param options - Menu configuration
   * @returns The created menu element
   */
  static createMenu(options: MenuOptions): HTMLElement {
    const {
      anchorEl,
      cssClass,
      title,
      items,
      onItemClick,
      showLevel = false,
      indentByLevel = false
    } = options;

    // Create menu in document body for proper positioning
    const menu = document.body.createDiv({ cls: cssClass });

    // Position menu near anchor element
    const anchorRect = anchorEl.getBoundingClientRect();
    menu.style.top = `${anchorRect.bottom + 5}px`;

    // Calculate horizontal position (center or left-aligned)
    if (cssClass.includes('heading-menu')) {
      // Heading menu: center horizontally
      const menuWidth = 300;
      const centerLeft = anchorRect.left + (anchorRect.width - menuWidth) / 2;
      const viewportWidth = window.innerWidth;
      const finalLeft = Math.max(10, Math.min(centerLeft, viewportWidth - menuWidth - 10));
      menu.style.left = `${finalLeft}px`;
    } else {
      // Outline menu: left-aligned with anchor
      menu.style.left = `${anchorRect.left}px`;
    }

    // Add title if provided
    if (title) {
      menu.createDiv({
        text: title,
        cls: 'dashreader-menu-title'
      });
    }

    // Add menu items
    items.forEach((item, index) => {
      const menuItem = menu.createDiv({
        cls: item.isCurrent
          ? 'dashreader-menu-item dashreader-menu-item-current'
          : 'dashreader-menu-item'
      });

      // Apply indentation if needed
      if (indentByLevel && item.level) {
        const indent = (item.level - 1) * 16;
        menuItem.style.paddingLeft = item.isCurrent ? `${8 + indent - 3}px` : `${8 + indent}px`;
      }

      // Add level indicator if needed
      if (showLevel && item.level) {
        menuItem.createSpan({
          text: `H${item.level}`,
          cls: 'dashreader-outline-level'
        });
      } else if (!showLevel) {
        // Add number for heading menu
        menuItem.createSpan({
          text: `${index + 1}.`,
          cls: 'dashreader-outline-level'
        });
      }

      // Add item text
      menuItem.createSpan({
        text: item.text,
        cls: 'dashreader-outline-text'
      });

      // Click handler
      menuItem.addEventListener('click', () => {
        onItemClick(item.wordIndex);
        menu.remove();
      });
    });

    // Close menu when clicking outside
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };

    // Delay adding the listener to avoid immediate close from the current click
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 10);

    return menu;
  }

  /**
   * Scrolls to the current item in the menu (for outline menu)
   *
   * @param menu - The menu element
   */
  static scrollToCurrentItem(menu: HTMLElement): void {
    setTimeout(() => {
      const currentItem = menu.querySelector('.dashreader-menu-item-current') as HTMLElement;
      if (currentItem) {
        currentItem.scrollIntoView({ block: 'center' });
      }
    }, 10);
  }
}
