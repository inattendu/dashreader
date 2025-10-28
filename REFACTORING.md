# DashReader - Roadmap de Refactorisation

> **Objectif** : Transformer DashReader en un plugin **rock-solid**, maintenable et extensible
> **Version actuelle** : 1.4.0
> **Version cible** : 2.0.0
> **Statut baseline** : ✅ Conformité Obsidian 100%

---

## 📊 État des Lieux

### Métriques Actuelles

| Métrique | Valeur | Statut |
|----------|--------|--------|
| Lignes de code | 5 757 | 🟠 |
| Fichiers TypeScript | 16 | ✅ |
| Complexité `loadText()` | ~12 | 🔴 |
| Complexité `calculateDelay()` | ~10 | 🟠 |
| Utilisation `as any` | 8 | 🟠 |
| Blocs try/catch | 56 | ✅ |
| `setTimeout` non gérés | 8 | 🟡 |

### Points Forts ✅

- ✅ Architecture modulaire claire
- ✅ Séparation View/Engine bien définie
- ✅ Utilisation de TypeScript
- ✅ Conformité Obsidian 100%
- ✅ Pas de dette technique critique
- ✅ Documentation inline complète

### Opportunités d'Amélioration ⚠️

- 🔴 **Critique** : Fonctions trop longues (>100 lignes)
- 🔴 **Critique** : Initialisations `null as any` (MinimapManager)
- 🟠 **Important** : Logique micropause complexe et non testable
- 🟠 **Important** : Duplication code breadcrumb
- 🟡 **Mineur** : Timeouts sans cleanup
- 🟡 **Mineur** : Type casts inutiles

---

## 🎯 Roadmap - 3 Phases

### 📅 Phase 1 : Sécurité & Stabilité (Semaine 1)

**Objectif** : Éliminer tous les risques de crash et memory leaks

#### 1.1 Corriger MinimapManager Initialisations 🔴
- **Fichier** : `src/minimap-manager.ts:31-33`
- **Problème** : `this.minimapEl = null as any;`
- **Solution** : Initialisation directe dans constructeur OU types optionnels
- **Tests requis** : Initialisation, destruction
- **Estimation** : 2h

#### 1.2 Implémenter TimeoutManager 🟡
- **Nouveau fichier** : `src/services/timeout-manager.ts`
- **Problème** : 8 `setTimeout` sans cleanup
- **Solution** : Service centralisé avec auto-cleanup
- **Impact** : Tous les composants avec setTimeout
- **Estimation** : 3h

#### 1.3 Ajouter Error Boundaries 🔴
- **Nouveau fichier** : `src/services/error-boundary.ts`
- **Objectif** : Gestion d'erreurs centralisée
- **Pattern** : Try/catch wrapper avec logging
- **Estimation** : 2h

#### 1.4 Validation Settings Robuste 🟠
- **Nouveau fichier** : `src/services/settings-validator.ts`
- **Objectif** : Valider settings à l'entrée
- **Tests requis** : Tous les ranges (WPM, fontSize, etc.)
- **Estimation** : 2h

**Livrables Phase 1** :
- [ ] MinimapManager type-safe
- [ ] TimeoutManager implémenté
- [ ] ErrorBoundary service créé
- [ ] SettingsValidator ajouté
- [ ] Tests unitaires (>80% coverage)
- [ ] Documentation mise à jour

**Durée estimée** : 3-4 jours

---

### 📅 Phase 2 : Qualité du Code (Semaine 2)

**Objectif** : Simplifier, découper et éliminer la duplication

#### 2.1 Refactorer loadText() 🔴
- **Fichier** : `src/rsvp-view.ts:910-1021`
- **Problème** : 111 lignes, complexité 12
- **Solution** : Extraire en 6 méthodes privées
- **Estimation** : 4h

```typescript
// Nouvelles méthodes
private parseAndPrepareText()
private validateTextLength()
private loadIntoEngine()
private updateUIForNewText()
private initializeNavigationComponents()
private maybeAutoStart()
```

#### 2.2 Refactorer calculateDelay() avec Strategy Pattern 🔴
- **Fichier** : `src/rsvp-engine.ts:208-273`
- **Nouveau fichier** : `src/services/micropause-service.ts`
- **Problème** : 66 lignes, logique complexe
- **Solution** : Strategy Pattern avec rules
- **Estimation** : 6h

```typescript
// Nouvelles classes
interface MicropauseRule {
  matches(text: string): boolean;
  getMultiplier(text: string, settings: DashReaderSettings): number;
}

class HeadingMicropauseRule implements MicropauseRule
class CalloutMicropauseRule implements MicropauseRule
class PunctuationMicropauseRule implements MicropauseRule
class NumberMicropauseRule implements MicropauseRule
// ... 6 autres rules
```

#### 2.3 Éliminer Duplication Breadcrumb 🟠
- **Fichiers** :
  - `src/rsvp-view.ts:983-1005`
  - `src/rsvp-engine.ts:395-418`
- **Solution** : Extraire vers `BreadcrumbManager`
- **Nouvelle méthode** : `buildHierarchicalBreadcrumb()`
- **Estimation** : 2h

#### 2.4 Corriger Type Casts 🟡
- **Fichiers** :
  - `src/dom-registry.ts:236`
  - `src/ui-builders.ts:308, 496`
  - `src/view-state.ts:387, 415`
- **Solution** : Génériques TypeScript corrects
- **Estimation** : 3h

#### 2.5 Extraire Services 🟠
- **Nouveau dossier** : `src/services/`
- **Nouveaux fichiers** :
  - `text-parser.service.ts` (MarkdownParser + word index)
  - `validation.service.ts` (Validations communes)
- **Estimation** : 4h

**Livrables Phase 2** :
- [ ] loadText() < 50 lignes
- [ ] calculateDelay() avec Strategy Pattern
- [ ] Breadcrumb sans duplication
- [ ] Aucun `as any` restant
- [ ] Services extraits et testés
- [ ] Tests unitaires mis à jour

**Durée estimée** : 5-6 jours

---

### 📅 Phase 3 : Tests & Documentation (Semaine 3)

**Objectif** : Garantir la qualité et faciliter la maintenance

#### 3.1 Tests Unitaires Complets
- **Framework** : Jest ou Vitest
- **Coverage cible** : >85%
- **Fichiers prioritaires** :
  - `micropause-service.ts` (logique métier critique)
  - `text-parser.service.ts`
  - `settings-validator.ts`
  - `timeout-manager.ts`
- **Estimation** : 8h

#### 3.2 Tests d'Intégration
- **Scénarios** :
  - Chargement texte → lecture → navigation
  - Settings update → UI refresh
  - Auto-load → cursor tracking
- **Estimation** : 6h

#### 3.3 Documentation Technique
- **Fichiers à créer/mettre à jour** :
  - `ARCHITECTURE.md` (diagrammes composants)
  - `TESTING.md` (guide tests)
  - `CONTRIBUTING.md` (guide contribution)
  - JSDoc sur toutes les méthodes publiques
- **Estimation** : 4h

#### 3.4 Performance Profiling
- **Outils** : Chrome DevTools
- **Métriques** :
  - Temps de parsing (>1000 mots)
  - Temps de rendu breadcrumb
  - Memory leaks check
- **Estimation** : 3h

**Livrables Phase 3** :
- [ ] Tests unitaires >85% coverage
- [ ] Tests d'intégration E2E
- [ ] Documentation complète
- [ ] Performance baseline établie
- [ ] CI/CD setup (GitHub Actions)

**Durée estimée** : 4-5 jours

---

## 📋 TODO List Détaillée

### 🔴 PHASE 1 - Sécurité & Stabilité

#### Task 1.1 : MinimapManager Type Safety
```typescript
// AVANT (src/minimap-manager.ts:31-33)
this.minimapEl = null as any;
this.progressEl = null as any;
this.tooltipEl = null as any;

// APRÈS - Option choisie : Initialisation directe
constructor(containerEl: HTMLElement, engine: RSVPEngine) {
  this.containerEl = containerEl;
  this.engine = engine;

  // Initialisation immédiate - pas de null!
  this.minimapEl = this.containerEl.createDiv({ cls: 'dashreader-minimap' });
  this.progressEl = this.minimapEl.createDiv({ cls: 'dashreader-minimap-progress' });
  this.minimapEl.createDiv({ cls: 'dashreader-minimap-line' });
  this.tooltipEl = document.body.createDiv({ cls: 'dashreader-minimap-tooltip' });

  // Plus besoin de initialize() séparé
}
```

**Checklist** :
- [ ] Supprimer méthode `initialize()`
- [ ] Déplacer création DOM dans constructeur
- [ ] Supprimer types `null as any`
- [ ] Ajouter test unitaire initialisation
- [ ] Vérifier pas de régression UI

---

#### Task 1.2 : TimeoutManager Service
```typescript
// NOUVEAU FICHIER: src/services/timeout-manager.ts

export class TimeoutManager {
  private timeouts = new Map<number, number>();
  private intervals = new Map<number, number>();

  setTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      callback();
      this.timeouts.delete(id);
    }, delay);
    this.timeouts.set(id, id);
    return id;
  }

  setInterval(callback: () => void, delay: number): number {
    const id = window.setInterval(callback, delay);
    this.intervals.set(id, id);
    return id;
  }

  clearTimeout(id: number): void {
    window.clearTimeout(id);
    this.timeouts.delete(id);
  }

  clearInterval(id: number): void {
    window.clearInterval(id);
    this.intervals.delete(id);
  }

  clearAll(): void {
    this.timeouts.forEach(id => window.clearTimeout(id));
    this.intervals.forEach(id => window.clearInterval(id));
    this.timeouts.clear();
    this.intervals.clear();
  }

  get activeCount(): number {
    return this.timeouts.size + this.intervals.size;
  }
}
```

**Fichiers à modifier** :
- [ ] `src/rsvp-view.ts` (3 setTimeout)
- [ ] `src/rsvp-engine.ts` (1 setTimeout pour timer)
- [ ] `src/menu-builder.ts` (2 setTimeout)
- [ ] `src/auto-load-manager.ts` (1 setTimeout)
- [ ] `src/minimap-manager.ts` (1 setTimeout)

**Pattern de migration** :
```typescript
// AVANT
setTimeout(() => {
  this.engine.play();
}, delay);

// APRÈS
this.timeoutManager.setTimeout(() => {
  this.engine.play();
}, delay);

// Dans onClose():
this.timeoutManager.clearAll();
```

---

#### Task 1.3 : Error Boundary Service
```typescript
// NOUVEAU FICHIER: src/services/error-boundary.ts

export class ErrorBoundary {
  static handle<T>(
    operation: () => T,
    context: string,
    fallback: T,
    notify: boolean = false
  ): T {
    try {
      return operation();
    } catch (error) {
      console.error(`DashReader error in ${context}:`, error);

      if (notify && this.shouldNotifyUser(error)) {
        new Notice(`DashReader: ${this.getUserMessage(error)}`);
      }

      return fallback;
    }
  }

  static async handleAsync<T>(
    operation: () => Promise<T>,
    context: string,
    fallback: T,
    notify: boolean = false
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`DashReader async error in ${context}:`, error);

      if (notify && this.shouldNotifyUser(error)) {
        new Notice(`DashReader: ${this.getUserMessage(error)}`);
      }

      return fallback;
    }
  }

  private static shouldNotifyUser(error: unknown): boolean {
    // Ne pas notifier pour erreurs bénignes
    if (error instanceof TypeError && error.message.includes('null')) {
      return false;
    }
    return true;
  }

  private static getUserMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}
```

**Zones d'application** :
- [ ] Parsing markdown (MarkdownParser)
- [ ] Chargement texte (loadText)
- [ ] Rendu breadcrumb
- [ ] Navigation minimap
- [ ] Settings update

---

#### Task 1.4 : Settings Validator
```typescript
// NOUVEAU FICHIER: src/services/settings-validator.ts

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class SettingsValidator {
  static validate(settings: DashReaderSettings): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // WPM validation
    if (settings.wpm < 50 || settings.wpm > 5000) {
      errors.push({
        field: 'wpm',
        message: 'WPM must be between 50 and 5000',
        severity: 'error'
      });
    }

    if (settings.wpm > 1000) {
      warnings.push({
        field: 'wpm',
        message: 'Very high WPM (>1000) may be difficult to read',
        severity: 'warning'
      });
    }

    // Font size validation
    if (settings.fontSize < 20 || settings.fontSize > 120) {
      errors.push({
        field: 'fontSize',
        message: 'Font size must be between 20 and 120px',
        severity: 'error'
      });
    }

    // Chunk size validation
    if (settings.chunkSize < 1 || settings.chunkSize > 5) {
      errors.push({
        field: 'chunkSize',
        message: 'Chunk size must be between 1 and 5',
        severity: 'error'
      });
    }

    // Micropause multipliers validation
    const micropauseFields = [
      'micropausePunctuation',
      'micropauseOtherPunctuation',
      'micropauseNumbers',
      'micropauseLongWords',
      'micropauseParagraph',
      'micropauseSectionMarkers',
      'micropauseListBullets',
      'micropauseCallouts'
    ];

    micropauseFields.forEach(field => {
      const value = settings[field as keyof DashReaderSettings] as number;
      if (value < 1.0 || value > 5.0) {
        errors.push({
          field,
          message: `${field} must be between 1.0 and 5.0`,
          severity: 'error'
        });
      }
    });

    // Acceleration validation
    if (settings.enableAcceleration) {
      if (settings.accelerationTargetWpm <= settings.wpm) {
        warnings.push({
          field: 'accelerationTargetWpm',
          message: 'Target WPM should be higher than start WPM',
          severity: 'warning'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static sanitize(settings: DashReaderSettings): DashReaderSettings {
    // Clamp values to valid ranges
    return {
      ...settings,
      wpm: Math.max(50, Math.min(5000, settings.wpm)),
      fontSize: Math.max(20, Math.min(120, settings.fontSize)),
      chunkSize: Math.max(1, Math.min(5, settings.chunkSize)),
      // ... autres champs
    };
  }
}
```

**Intégration** :
```typescript
// Dans main.ts:loadSettings()
async loadSettings() {
  const rawSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  const validation = SettingsValidator.validate(rawSettings);

  if (!validation.valid) {
    console.error('Invalid settings:', validation.errors);
    this.settings = SettingsValidator.sanitize(rawSettings);
    new Notice('Some settings were invalid and have been corrected');
  } else {
    this.settings = rawSettings;
  }

  if (validation.warnings.length > 0) {
    console.warn('Settings warnings:', validation.warnings);
  }
}
```

---

### 🟠 PHASE 2 - Qualité du Code

#### Task 2.1 : Refactorer loadText()

**Extraction de méthodes** :

```typescript
// AVANT : 111 lignes monolithiques
public loadText(text: string, source?: SourceInfo): void {
  // 111 lignes de code...
}

// APRÈS : 6 méthodes bien définies
public loadText(text: string, source?: SourceInfo): void {
  this.stopCurrentReading();

  const { plainText, wordIndex } = this.parseAndPrepareText(text, source);
  if (!this.validateTextLength(plainText)) return;

  this.loadIntoEngine(plainText, wordIndex);
  this.updateUIForNewText(wordIndex, source);
  this.initializeNavigationComponents(wordIndex);
  this.maybeAutoStart();
}

private stopCurrentReading(): void {
  if (this.engine.getIsPlaying()) {
    this.engine.stop();
    updatePlayPauseButtons(this.dom, false);
  }
}

private parseAndPrepareText(
  text: string,
  source?: SourceInfo
): { plainText: string; wordIndex?: number } {
  this.breadcrumbManager.reset();
  const plainText = MarkdownParser.parseToPlainText(text);

  const wordIndex = source?.cursorPosition
    ? this.calculateWordIndexFromCursor(text, source.cursorPosition)
    : undefined;

  return { plainText, wordIndex };
}

private calculateWordIndexFromCursor(text: string, cursorPosition: number): number {
  const textUpToCursor = text.substring(0, cursorPosition);
  const parsedUpToCursor = MarkdownParser.parseToPlainText(textUpToCursor);
  const wordsBeforeCursor = parsedUpToCursor.trim().split(/\s+/).filter(w => w.length > 0);
  return wordsBeforeCursor.length;
}

private validateTextLength(plainText: string): boolean {
  return plainText && plainText.trim().length >= TEXT_LIMITS.minParsedLength;
}

private loadIntoEngine(plainText: string, wordIndex?: number): void {
  this.engine.setText(plainText, undefined, wordIndex);
  this.state.update({ wordsRead: 0, startTime: 0 });
  this.clearWelcomeMessage();
}

private clearWelcomeMessage(): void {
  const welcomeMsg = this.wordEl.querySelector(`.${CSS_CLASSES.welcome}`);
  if (welcomeMsg) {
    welcomeMsg.remove();
  }
  this.wordEl.empty();
}

private updateUIForNewText(wordIndex: number | undefined, source?: SourceInfo): void {
  const totalWords = this.engine.getTotalWords();
  const remainingWords = this.engine.getRemainingWords();
  const estimatedDuration = this.engine.getEstimatedDuration();
  const durationText = formatTime(estimatedDuration);

  this.updateStatsDisplay(wordIndex, totalWords, remainingWords, durationText, source);
  this.displayReadyMessage(wordIndex, totalWords, remainingWords, durationText, source);
}

private updateStatsDisplay(
  wordIndex: number | undefined,
  totalWords: number,
  remainingWords: number,
  durationText: string,
  source?: SourceInfo
): void {
  const fileInfo = source?.fileName ? ` from ${source.fileName}` : '';
  const wordInfo = wordIndex && wordIndex > 0
    ? `${remainingWords}/${totalWords} words`
    : `${totalWords} words`;

  this.dom.updateText('statsText', `${wordInfo} loaded${fileInfo} - ~${durationText} - Shift+Space to start`);
}

private displayReadyMessage(
  wordIndex: number | undefined,
  totalWords: number,
  remainingWords: number,
  durationText: string,
  source?: SourceInfo
): void {
  this.wordDisplay.displayReadyMessage(
    remainingWords,
    totalWords,
    wordIndex,
    durationText,
    source?.fileName,
    source?.lineNumber
  );
}

private initializeNavigationComponents(wordIndex?: number): void {
  this.initializeBreadcrumb(wordIndex);
  this.minimapManager?.render();
}

private initializeBreadcrumb(wordIndex?: number): void {
  const allHeadings = this.engine.getHeadings();
  if (allHeadings.length === 0) return;

  const startIndex = wordIndex ?? 0;
  const breadcrumb = this.breadcrumbManager.buildHierarchicalBreadcrumb(
    allHeadings,
    startIndex
  );

  if (breadcrumb.length > 0) {
    const context: HeadingContext = {
      breadcrumb,
      current: breadcrumb[breadcrumb.length - 1] || null
    };
    this.breadcrumbManager.updateBreadcrumb(context);
  }
}

private maybeAutoStart(): void {
  if (!this.settings.autoStart) return;

  this.timeoutManager.setTimeout(() => {
    this.engine.play();
    updatePlayPauseButtons(this.dom, true);
    this.state.set('startTime', Date.now());
  }, this.settings.autoStartDelay * 1000);
}
```

**Checklist** :
- [ ] Extraire méthodes privées
- [ ] Vérifier couverture tests
- [ ] Mesurer complexité cyclomatique (<5)
- [ ] Vérifier pas de régression
- [ ] Mettre à jour documentation

---

#### Task 2.2 : Micropause Service

```typescript
// NOUVEAU FICHIER: src/services/micropause-service.ts

export interface MicropauseRule {
  readonly name: string;
  readonly priority: number; // Pour ordre d'application
  matches(text: string): boolean;
  getMultiplier(text: string, settings: DashReaderSettings): number;
}

export class HeadingMicropauseRule implements MicropauseRule {
  readonly name = 'heading';
  readonly priority = 1; // Highest priority

  private static readonly MULTIPLIERS: Record<number, number> = {
    1: 2.0, 2: 1.8, 3: 1.5, 4: 1.3, 5: 1.2, 6: 1.1
  };

  matches(text: string): boolean {
    return /^\[H[1-6]\]/.test(text.trim());
  }

  getMultiplier(text: string, _settings: DashReaderSettings): number {
    const match = text.trim().match(/^\[H(\d)\]/);
    if (!match) return 1.0;

    const level = parseInt(match[1]);
    return HeadingMicropauseRule.MULTIPLIERS[level] || 1.0;
  }
}

export class CalloutMicropauseRule implements MicropauseRule {
  readonly name = 'callout';
  readonly priority = 2;

  matches(text: string): boolean {
    return /^\[CALLOUT:[\w-]+\]/.test(text.trim());
  }

  getMultiplier(_text: string, settings: DashReaderSettings): number {
    return settings.micropauseCallouts;
  }
}

export class SentencePunctuationRule implements MicropauseRule {
  readonly name = 'sentence-punctuation';
  readonly priority = 5;

  matches(text: string): boolean {
    return /[.!?]$/.test(text);
  }

  getMultiplier(_text: string, settings: DashReaderSettings): number {
    return settings.micropausePunctuation;
  }
}

// ... Autres rules (8 au total)

export class MicropauseService {
  private rules: MicropauseRule[];

  constructor() {
    this.rules = [
      new HeadingMicropauseRule(),
      new CalloutMicropauseRule(),
      new SectionMarkerRule(),
      new ListBulletRule(),
      new SentencePunctuationRule(),
      new OtherPunctuationRule(),
      new NumberRule(),
      new LongWordRule(),
      new ParagraphRule()
    ].sort((a, b) => a.priority - b.priority);
  }

  calculateMultiplier(text: string, settings: DashReaderSettings): number {
    return this.rules.reduce((multiplier, rule) => {
      if (rule.matches(text)) {
        return multiplier * rule.getMultiplier(text, settings);
      }
      return multiplier;
    }, 1.0);
  }

  // Pour debugging/testing
  getApplicableRules(text: string): string[] {
    return this.rules
      .filter(rule => rule.matches(text))
      .map(rule => rule.name);
  }
}
```

**Migration dans RSVPEngine** :
```typescript
// Dans RSVPEngine
private micropauseService: MicropauseService;

constructor(...) {
  // ...
  this.micropauseService = new MicropauseService();
}

private calculateDelay(text: string): number {
  const currentWpm = this.getCurrentWpm();
  const baseDelay = (60 / currentWpm) * 1000;

  if (!this.settings.enableMicropause) {
    return baseDelay;
  }

  const multiplier = this.micropauseService.calculateMultiplier(text, this.settings);
  return baseDelay * multiplier;
}
```

**Tests unitaires** :
```typescript
describe('MicropauseService', () => {
  it('should apply heading multiplier for H1', () => {
    const service = new MicropauseService();
    const text = '[H1]Title';
    const multiplier = service.calculateMultiplier(text, DEFAULT_SETTINGS);
    expect(multiplier).toBe(2.0);
  });

  it('should stack multipliers correctly', () => {
    const service = new MicropauseService();
    const text = '[H2]Title with number 123.'; // H2 + number + sentence
    // Expected: 1.8 (H2) * 1.8 (number) * 2.5 (sentence) = 8.1
    const multiplier = service.calculateMultiplier(text, DEFAULT_SETTINGS);
    expect(multiplier).toBeCloseTo(8.1, 1);
  });
});
```

---

#### Task 2.3 : Éliminer Duplication Breadcrumb

**Nouvelle méthode dans BreadcrumbManager** :
```typescript
// src/breadcrumb-manager.ts

/**
 * Build hierarchical breadcrumb from flat heading list
 * Maintains proper nesting: H1 > H2 > H3 (pops when level decreases)
 *
 * @param allHeadings - All headings in document
 * @param currentIndex - Current word index
 * @returns Hierarchical breadcrumb array
 */
buildHierarchicalBreadcrumb(
  allHeadings: HeadingInfo[],
  currentIndex: number
): HeadingInfo[] {
  const relevantHeadings = allHeadings.filter(h => h.wordIndex <= currentIndex);
  const breadcrumb: HeadingInfo[] = [];
  let currentLevel = 0;

  for (const heading of relevantHeadings) {
    // Pop headings of same or higher level
    if (heading.level <= currentLevel) {
      while (breadcrumb.length > 0 && breadcrumb[breadcrumb.length - 1].level >= heading.level) {
        breadcrumb.pop();
      }
    }
    breadcrumb.push(heading);
    currentLevel = heading.level;
  }

  return breadcrumb;
}
```

**Suppression duplication** :
- [ ] Supprimer logique de `rsvp-view.ts:983-1005`
- [ ] Supprimer logique de `rsvp-engine.ts:395-418`
- [ ] Utiliser `breadcrumbManager.buildHierarchicalBreadcrumb()` partout
- [ ] Tests unitaires sur la logique de nesting

---

## 📈 Métriques Cibles

### Avant Refactorisation
```
Complexité loadText()      : 12
Complexité calculateDelay() : 10
Lignes loadText()          : 111
Lignes calculateDelay()    : 66
Type casts (as any)        : 8
Duplication                : 2 blocs identiques
Tests coverage             : ~40%
```

### Après Refactorisation
```
Complexité loadText()      : 4  (-67%)
Complexité calculateDelay() : 3  (-70%)
Lignes loadText()          : 30 (-73%)
Lignes calculateDelay()    : 15 (-77%)
Type casts (as any)        : 0  (-100%)
Duplication                : 0  (-100%)
Tests coverage             : >85% (+45pp)
```

---

## 🚀 Stratégie de Migration

### Principe : Changements Incrémentaux
1. ✅ Créer branche feature par task
2. ✅ Garder `main` toujours fonctionnel
3. ✅ Tests avant/après chaque changement
4. ✅ Review + merge progressif

### Ordre d'Exécution
```
Phase 1.1 → Phase 1.2 → Phase 1.3 → Phase 1.4
     ↓
Phase 2.1 → Phase 2.2 (parallel)
     ↓           ↓
Phase 2.3 → Phase 2.4 → Phase 2.5
     ↓
Phase 3.1 → Phase 3.2 → Phase 3.3 → Phase 3.4
```

### Branches Git
```
main
  └─ refactor/vanilla-improvements (current)
       ├─ refactor/phase1-security
       │    ├─ feat/minimap-type-safety
       │    ├─ feat/timeout-manager
       │    ├─ feat/error-boundary
       │    └─ feat/settings-validator
       ├─ refactor/phase2-quality
       │    ├─ feat/extract-loadText
       │    ├─ feat/micropause-service
       │    ├─ feat/breadcrumb-dedup
       │    └─ feat/remove-type-casts
       └─ refactor/phase3-tests
            ├─ feat/unit-tests
            ├─ feat/integration-tests
            └─ feat/documentation
```

---

## ✅ Checklist de Release 2.0.0

### Code Quality
- [ ] Aucune fonction >50 lignes
- [ ] Complexité cyclomatique <10 partout
- [ ] Aucun `as any` restant
- [ ] Aucune duplication détectée
- [ ] Tous les timeouts gérés

### Tests
- [ ] Coverage >85%
- [ ] Tests unitaires passent
- [ ] Tests intégration passent
- [ ] Tests manuels OK

### Documentation
- [ ] ARCHITECTURE.md créé
- [ ] TESTING.md créé
- [ ] CONTRIBUTING.md mis à jour
- [ ] JSDoc complet

### Performance
- [ ] Parsing <100ms (1000 mots)
- [ ] Breadcrumb render <50ms
- [ ] Aucun memory leak détecté
- [ ] Baseline établi

### Obsidian Compliance
- [ ] Guidelines respectées
- [ ] Build production OK
- [ ] Plugin testé dans Obsidian
- [ ] Prêt pour soumission

---

## 📞 Support & Questions

- **Issues GitHub** : Pour bugs et features
- **Discussions** : Pour questions architecture
- **Wiki** : Documentation détaillée

**Auteur** : DashReader Team
**Dernière mise à jour** : 2025-01-28
**Version** : 1.0
