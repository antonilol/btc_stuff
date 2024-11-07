import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [
    ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"),
    {
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 5,
            sourceType: "script",

            parserOptions: {
                project: "./tsconfig.json",
            },
        },

        rules: {
            "@typescript-eslint/no-namespace": 0,
            "@typescript-eslint/no-unused-vars": 0,
            "@typescript-eslint/ban-types": 0,
            "@typescript-eslint/no-non-null-assertion": 0,
            "@typescript-eslint/no-deprecated": "error",
            "no-constant-condition": 0,
            "no-empty": 0,
            "prefer-const": 1,
            "no-inner-declarations": 0,
        },
    },
];