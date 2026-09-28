import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
    rules: {
      // Client-only prototypes intentionally hydrate localStorage-backed state in effects.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
