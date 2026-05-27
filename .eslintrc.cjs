module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['react-refresh'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-refresh/only-export-components': 'off',
    'no-unused-vars': 'off',
    'no-constant-condition': 'off',
    'no-extra-semi': 'off',
    'no-empty': 'off',
    'no-undef': 'off',
    'react/no-unescaped-entities': 'off',
    'react-hooks/exhaustive-deps': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/'],
};
