#!/bin/bash
# Script d'installation locale de DashReader pour Obsidian

# Couleurs pour la sortie
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Installation locale de DashReader${NC}"
echo ""

# Vérifier que le chemin du vault est fourni en argument
if [ -z "$1" ]; then
  echo -e "${RED}❌ Erreur: Chemin du vault manquant${NC}"
  echo ""
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  ./install-local.sh /path/to/vault"
  echo ""
  echo -e "${BLUE}Exemple:${NC}"
  echo -e "  ./install-local.sh /Users/nom/Documents/MonVault"
  echo ""
  exit 1
fi

VAULT_PATH="$1"

# Vérifier que le vault existe
if [ ! -d "$VAULT_PATH" ]; then
  echo -e "${RED}❌ Le dossier n'existe pas: $VAULT_PATH${NC}"
  exit 1
fi

# Créer le dossier plugins si nécessaire
PLUGIN_PATH="$VAULT_PATH/.obsidian/plugins/dashreader"
mkdir -p "$PLUGIN_PATH"

echo ""
echo -e "${BLUE}📦 Copie des fichiers...${NC}"

# Vérifier que main.js existe
if [ ! -f "main.js" ]; then
  echo -e "${RED}❌ main.js n'existe pas. Exécutez 'npm run build' d'abord.${NC}"
  exit 1
fi

# Copier les fichiers
cp main.js "$PLUGIN_PATH/" && echo -e "${GREEN}  ✓ main.js${NC}"
cp manifest.json "$PLUGIN_PATH/" && echo -e "${GREEN}  ✓ manifest.json${NC}"
cp styles.css "$PLUGIN_PATH/" && echo -e "${GREEN}  ✓ styles.css${NC}"

echo ""
echo -e "${GREEN}✅ DashReader installé avec succès !${NC}"
echo ""
echo -e "${YELLOW}📝 Prochaines étapes:${NC}"
echo -e "   1. Ouvrir Obsidian"
echo -e "   2. Settings (⚙️) → Community plugins"
echo -e "   3. Désactiver 'Safe mode' si nécessaire"
echo -e "   4. Cliquer sur 'Reload' pour rafraîchir"
echo -e "   5. Activer 'DashReader' dans la liste"
echo ""
echo -e "${BLUE}🎯 Pour tester:${NC}"
echo -e "   • Cliquer sur l'icône ⚡ dans la sidebar"
echo -e "   • Ou: Cmd+P → 'Open DashReader'"
echo -e "   • Sélectionner du texte → Click droit → 'Read with DashReader'"
echo ""
echo -e "${BLUE}📍 Plugin installé dans:${NC}"
echo -e "   $PLUGIN_PATH"
echo ""
