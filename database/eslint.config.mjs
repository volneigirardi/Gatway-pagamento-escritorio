import config from '@saas/eslint-config/node.mjs';

export default [
  ...config,
  {
    // These are CLI scripts (migrations, backup/restore, seed) meant to be
    // run manually or from CI/Jobs — console output is the intended UX,
    // unlike application code which must use the structured logger.
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
