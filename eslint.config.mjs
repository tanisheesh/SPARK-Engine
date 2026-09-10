import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Self-contained sub-projects with their own toolchains. /mobile is an
    // Expo app (React Native, not DOM) and /relay is plain Node — linting
    // either with the Next.js web config reports nothing useful.
    "mobile/**",
    "relay/**",
  ]),
]);

export default eslintConfig;
