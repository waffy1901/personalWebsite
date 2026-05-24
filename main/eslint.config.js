const js = require("@eslint/js")
const react = require("eslint-plugin-react")
const reactHooks = require("eslint-plugin-react-hooks")
const globals = require("globals")

module.exports = [
  {
    ignores: ["build/**", "coverage/**", "dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^React$",
        },
      ],
      "react/prop-types": "off",
    },
  },
  {
    files: ["src/**/*.{test,spec}.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.vitest,
      },
    },
  },
]
