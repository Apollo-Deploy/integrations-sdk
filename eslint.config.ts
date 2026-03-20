import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // ── Ignored paths ───────────────────────────────────────────────────────────
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
    ],
  },

  // ── Base JS recommended ──────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript strict + stylistic ───────────────────────────────────────────
  // Includes: ban-ts-comment (requires description), only-throw-error,
  // use-unknown-in-catch-variables, no-explicit-any, no-unsafe-*, and more.
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ── Global settings ──────────────────────────────────────────────────────────
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Project-wide rule overrides ──────────────────────────────────────────────
  {
    rules: {
      // ── Bans on unsafe / imprecise types ─────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",

      // ── Require explicit return types & param types ─────────────────────────
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // ── Nullish / strictness ─────────────────────────────────────────────────
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: true,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
        },
      ],

      // ── Promise / async hygiene ────────────────────────────────────────────
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: { attributes: false },
        },
      ],
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/promise-function-async": [
        "error",
        { checkArrowFunctions: false },
      ],

      // ── Immutability ─────────────────────────────────────────────────────────
      // Flag class properties / method params that could be declared readonly.
      "@typescript-eslint/prefer-readonly": "error",

      // ── Code quality ─────────────────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/prefer-as-const": "error",

      // ── Deprecated API usage — warn (some library APIs have no clean alternative) ─
      "@typescript-eslint/no-deprecated": "warn",

      // ── Error handling ───────────────────────────────────────────────────────
      // Disallow silent console.log-only error strategies; use a logger with context.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Empty catch blocks swallow errors silently.
      "no-empty": ["error", { allowEmptyCatch: false }],

      // ── Security ─────────────────────────────────────────────────────────────
      // Forbid eval() — arbitrary code execution risk.
      "no-eval": "error",
      // Forbid new Function() — equivalent to eval().
      "no-new-func": "error",
      // Forbid javascript: URLs — XSS vector.
      "no-script-url": "error",

      // ── Function complexity / code structure ──────────────────────────────────
      // Functions must do one thing — cap at 40 LOC (excluding blanks & comments).
      "max-lines-per-function": [
        "warn",
        {
          max: 40,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      // More than 3 positional params → use an options object instead.
      "max-params": ["error", { max: 3 }],
      // Nesting beyond 3 levels is a readability/maintainability smell.
      "max-depth": ["error", { max: 3 }],
      // Disallow mutating function arguments (encourages pure functions).
      "no-param-reassign": ["error", { props: false }],

      // ── Magic values ─────────────────────────────────────────────────────────
      // Use named constants — except for the most universally understood literals.
      "@typescript-eslint/no-magic-numbers": [
        "warn",
        {
          ignore: [-1, 0, 1, 2, 10, 100, 1000],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreClassFieldInitialValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      // Disable the base rule — the TS-aware version above supersedes it.
      "no-magic-numbers": "off",

      // ── Disabled base rules overridden by TS equivalents ──────────────────
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },

  // ── Adapter implementation overrides ───────────────────────────────────────
  // Provider SDK/API payloads are largely dynamic and schema-lite in adapter
  // implementation files, so we relax the most noisy strict rules here.
  {
    files: ["packages/adapter-*/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/promise-function-async": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/strict-boolean-expressions": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "max-lines-per-function": "off",
    },
  },

  // ── Core integrations overrides ────────────────────────────────────────────
  {
    files: ["packages/integrations/src/crypto.ts"],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
    },
  },
  {
    files: [
      "packages/integrations/src/define-adapter.ts",
      "packages/integrations/src/hub.ts",
    ],
    rules: {
      "max-lines-per-function": "off",
    },
  },
  {
    files: ["packages/integrations/src/hub.ts"],
    rules: {
      "max-depth": "off",
    },
  },

  // ── Test file overrides ──────────────────────────────────────────────────────
  // Tests must still use typed mocks (no-explicit-any stays on). Relax only
  // the structural rules that are routinely impractical in test suites.
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      // Magic numbers in test data are intentional (boundary values, counts, etc.)
      "@typescript-eslint/no-magic-numbers": "off",
      // Test helpers/describe blocks routinely exceed 40 lines structurally.
      "max-lines-per-function": "off",
      // Test setup functions sometimes need more than 3 params.
      "max-params": "off",
      // Explicit return types on test callbacks add noise without value.
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
);
