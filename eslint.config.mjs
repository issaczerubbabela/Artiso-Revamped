import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-preview/**',
      '**/.next/**',
      '**/out/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
  // Architectural boundary: core-engine must stay DOM/React/Capacitor-free
  // (see docs/architecture/00-system-overview.md §5 and ki-grid-image-independence).
  {
    files: ['packages/core-engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'core-engine must stay DOM/React-free (see architecture/00 §5).' },
            { name: 'react-dom', message: 'core-engine must stay DOM/React-free.' },
            { name: 'next', message: 'core-engine must stay DOM/React-free.' },
          ],
          patterns: ['next/*', '@capacitor/*'],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage'],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
);
