/**
 * Commitlint configuration for conventional commits.
 *
 * @see https://commitlint.js.org/
 * @see https://www.conventionalcommits.org/
 * @type {import('@commitlint/types').UserConfig}
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Ensure the body and footer have a blank line before them
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],

    // Limit header length to 100 characters
    'header-max-length': [2, 'always', 100],

    // Allowed commit types
    'type-enum': [
      2,
      'always',
      [
        'build', // Changes that affect the build system or external dependencies
        'chore', // Other changes that don't modify src or test files
        'ci', // Changes to CI configuration files and scripts
        'docs', // Documentation only changes
        'feat', // A new feature
        'fix', // A bug fix
        'perf', // A code change that improves performance
        'refactor', // A code change that neither fixes a bug nor adds a feature
        'revert', // Reverts a previous commit
        'style', // Changes that do not affect the meaning of the code
        'test', // Adding missing tests or correcting existing tests
      ],
    ],
  },
}
