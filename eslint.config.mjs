// Flat config for ESLint 9 + Next 16.
// eslint-config-next 16 exposes flat configs at /core-web-vitals and /typescript.
// Each is a default export of a flat-config array.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'infra/data/**'],
  },
];

export default config;
