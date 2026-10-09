import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist", "node_modules", "ios", "android"] },
  js.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        __SHOW_SAMPLES__: "readonly",
        __APP_VERSION__: "readonly",
        __DEVICE_PREVIEW__: "readonly",
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      // useEveryShow takes deps like useEffect; check them the same way.
      "react-hooks/exhaustive-deps": ["warn", { additionalHooks: "^useEveryShow$" }],
    },
  },
  {
    files: ["tests/**", "tools/**", "*.config.js", "*.config.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright's fixtures hand over with a function named `use`, which
    // the React hooks rule would take for React's.
    files: ["tests/e2e/**"],
    // Code passed to page.evaluate runs in the browser.
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];
