// Lint rules: the recommended sets for JavaScript, TypeScript and React hooks. Formatting is
// Prettier's job, so nothing here is about style.
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['out/', 'release/', 'node_modules/', '.vandelay/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'test/**/*.ts', 'e2e/**/*.ts', 'scripts/**/*.mjs', '*.config.{ts,mjs}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['src/main/hooks/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  {
    rules: {
      // `_name` marks a value we destructure only to drop it.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }]
    }
  }
)
