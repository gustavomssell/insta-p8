import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Standalone Node smoke tests, not app code.
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
  ]),
  {
    rules: {
      // Legacy style debt: the codebase is full of `any` (webhook payloads,
      // response_content JSONB, untyped Supabase rows). Warning keeps the
      // issue visible without failing CI; tighten to "error" as they get typed.
      "@typescript-eslint/no-explicit-any": "warn",
      // Common shadcn/session patterns (initial state from window/localStorage
      // inside an effect). Harmless here; revisit if we adopt React Compiler.
      "react-hooks/set-state-in-effect": "warn",
      // Known false positives: Date.now() inside an event handler
      // (ChatWindow) and Math.random() in a memoized shadcn skeleton.
      "react-hooks/purity": "warn",
    },
  },
])

export default eslintConfig
