import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier/flat";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "data/**",
      "scripts/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.cjs",
    ],
  },
  ...nextCoreWebVitals,
  eslintConfigPrettier,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/checkpoint-te",
              message:
                "❌ SECURITY: checkpoint-te.ts must NOT be imported in client components. API keys are server-side only. Use API routes instead.",
            },
            {
              name: "@/lib/api-keys-storage",
              message:
                "❌ SECURITY: api-keys-storage.ts must NOT be imported in client components. API keys are server-side only. Use API routes instead.",
            },
          ],
          patterns: [
            {
              group: ["**/lib/checkpoint-te"],
              message:
                "❌ SECURITY: checkpoint-te.ts must NOT be imported in client components. API keys are server-side only. Use API routes instead.",
            },
            {
              group: ["**/lib/api-keys-storage"],
              message:
                "❌ SECURITY: api-keys-storage.ts must NOT be imported in client components. API keys are server-side only. Use API routes instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/api/**/*.ts", "lib/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
