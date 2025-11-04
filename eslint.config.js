import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default [
  {
    ignores: ["main.js", "*.mjs", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      obsidianmd: obsidianmd
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": ["error", { fixToUnknown: false }],
      "@typescript-eslint/no-floating-promises": "error",

      // General rules
      "no-console": ["error", { "allow": ["warn", "error", "debug"] }],
      "no-prototype-builtins": "off",

      // Obsidian plugin rules
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/ui/sentence-case": ["error", { enforceCamelCaseLower: true }],
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/detach-leaves": "error",
    }
  }
];
