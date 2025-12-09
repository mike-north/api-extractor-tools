# Development Guide

This guide explains how to develop, test, and contribute to the api-extractor-tools monorepo.

This is a **pnpm workspace monorepo** managed with [Nx](https://nx.dev/) for task orchestration and [Changesets](https://github.com/changesets/changesets) for versioning and releases.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Working with Changesets](#working-with-changesets)
- [Testing](#testing)
- [Demo Site](#demo-site)
- [Release Process](#release-process)
- [Common Commands](#common-commands)

## Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v10.24.0 (automatically used via `packageManager` field)
- **Git**: For version control

## Getting Started

1. **Clone the repository**

   ```bash
   git clone git@github.com:mike-north/api-extractor-tools.git
   cd api-extractor-tools
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Build all packages**

   ```bash
   pnpm build
   ```

4. **Run tests**

   ```bash
   pnpm test
   ```

## Development Workflow

### Making Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** to the relevant package(s):
   - `tools/change-detector/` - API change detection tool (file-based, CLI)
   - `tools/change-detector-core/` - Isomorphic core for change detection (browser + Node.js)
   - `tools/input-processor-typescript/` - TypeScript input processor plugin
   - `tools/module-declaration-merger/` - Module declaration merger tool
   - `tools/changeset-change-detector/` - Changesets plugin for automated version bumps
   - `tools/change-detector-semantic-release-plugin/` - semantic-release plugin
   - `tools/demo-site/` - Interactive demo web application

3. **Build and test your changes**

   ```bash
   pnpm build
   pnpm test
   ```

4. **Lint and type-check**

   ```bash
   pnpm check
   ```

### Before Committing

**Important**: Before you commit, you must create a changeset describing your changes.

### Git Hooks

This repository uses [Husky](https://typicode.github.io/husky/) to enforce quality checks:

**Pre-commit Hook** (`.husky/pre-commit`):

- Lints and formats staged files
- Runs workspace-wide checks (knip)
- Builds all packages
- Runs tests for uncommitted changes
- Generates API reports
- Generates documentation

**Commit-msg Hook** (`.husky/commit-msg`):

- Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) format
- Ensures header length is ≤100 characters
- Verifies allowed commit types are used

These hooks run automatically when you commit. If any check fails, the commit will be rejected.

## Working with Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every PR that changes package functionality must include a changeset.

### What is a Changeset?

A changeset is a markdown file that describes:

- Which package(s) changed
- The type of change (major/minor/patch)
- A human-readable description of what changed

### Creating a Changeset

You have two options for creating changesets:

#### Option 1: Auto-generate from API changes (Recommended)

Use the changeset-change-detector plugin to automatically analyze your API changes and create a changeset with the correct version bump:

```bash
pnpm changeset:auto
```

This will:

1. Analyze API changes in all packages by comparing declaration files
2. Determine the appropriate version bump (major/minor/patch) based on the changes
3. Generate a changeset file with a summary of detected changes

For non-interactive usage (CI):

```bash
pnpm changeset:auto --yes
```

#### Option 2: Manual changeset creation

Run the interactive changeset CLI:

```bash
pnpm changeset
```

You'll be prompted with:

1. **Which packages have changed?**
   - Use arrow keys and space to select packages
   - Press Enter to continue

2. **What kind of change is this?**
   - `major` (breaking change) - e.g., removing a public API, changing behavior
   - `minor` (new feature) - e.g., adding new functionality
   - `patch` (bug fix) - e.g., fixing a bug, updating docs

   **Note**: We're currently in alpha prerelease mode, so all versions will be tagged as `0.0.x-alpha.y`

3. **Write a summary**
   - Explain what changed and why
   - Be clear and concise
   - This will appear in the CHANGELOG

**Example output:**

```text
🦋  Which packages would you like to include?
◯ @api-extractor-tools/change-detector
◯ @api-extractor-tools/module-declaration-merger

🦋  Which packages should have a major bump?
🦋  Which packages should have a minor bump?
◉ @api-extractor-tools/change-detector

🦋  Summary: Added support for detecting generic type parameter changes
```

This creates a file in `.changeset/` with a random name like `.changeset/fuzzy-cats-smile.md`.

### Changeset Guidelines

**When to create a changeset:**

- ✅ Adding a new feature
- ✅ Fixing a bug
- ✅ Changing public API behavior
- ✅ Updating documentation that affects usage

**When NOT to create a changeset:**

- ❌ Updating internal dev dependencies
- ❌ Changing CI configuration
- ❌ Refactoring with no user-facing changes
- ❌ Updating README or development docs

### Changeset Examples

**Good changeset summary:**

```markdown
Added support for detecting changes to generic type parameter constraints.
The change detector now correctly identifies when `<T extends Foo>` changes
to `<T extends Bar>` as a breaking change.
```

**Poor changeset summary:**

```markdown
Fixed bug
```

### Committing Your Changes

After creating a changeset:

```bash
git add .changeset/your-changeset-name.md
git add <your other changed files>
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

We follow [Conventional Commits](https://www.conventionalcommits.org/), which are automatically validated by commitlint:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `test:` - Adding tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks
- `build:` - Build system changes
- `ci:` - CI configuration changes
- `perf:` - Performance improvements
- `style:` - Code style changes (formatting, etc.)
- `revert:` - Revert a previous commit

**Commit Message Format:**

```text
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

**Examples:**

```bash
# Simple commit
git commit -m "feat: add support for generic type parameters"

# With scope
git commit -m "fix(parser): handle empty module declarations"

# With body
git commit -m "refactor: simplify symbol comparison logic

This change extracts the comparison logic into separate
functions for better testability and maintainability."
```

**Important**: Commit messages are validated automatically by commitlint. If your commit message doesn't follow the conventional commit format, the commit will be rejected. The header must be 100 characters or less.

### Validating Changesets

Before submitting a PR, you can validate that your changesets have appropriate version bumps:

```bash
pnpm changeset:validate
```

This checks that:

- All packages with API changes have corresponding changesets
- The declared version bumps are at least as severe as what the API changes require
- Breaking changes have detailed descriptions

### Creating a Pull Request

1. Push your branch and open a PR on GitHub
2. The CI will run tests and checks
3. Reviewers will check for a changeset file
4. Once approved, your PR will be merged

## Testing

### Run all tests

```bash
pnpm test
```

### Run tests for files changed since the last commit

```bash
pnpm test:changed
```

### Run tests for current uncommitted changes

```bash
pnpm test:uncommitted
```

### Run tests for a specific package

```bash
cd tools/change-detector
pnpm test
```

### Run tests in watch mode

```bash
cd tools/change-detector
pnpm test --watch
```

### Type checking

```bash
# Check all packages
pnpm check:packages

# Check workspace configuration
pnpm check:workspace

# Check everything
pnpm check
```

### Linting

```bash
# Lint all packages
pnpm check

# Lint specific package
cd tools/change-detector
pnpm check:eslint
```

## Developing Input Processor Plugins

The change detector supports a plugin system for processing different input formats (TypeScript, GraphQL, OpenAPI, etc.). Plugins convert various formats into the normalized `Map<string, ExportedSymbol>` representation.

### Plugin Architecture

- **Plugin Interface**: Defined in `tools/change-detector-core/src/plugin-types.ts`
- **Discovery Mechanism**: Plugins are discovered via the `"change-detector:input-processor-plugin"` keyword in `package.json`
- **Isomorphic**: Plugins should work in both Node.js and browser environments when possible

### Creating a New Plugin

1. **Create package structure**:

   ```bash
   mkdir -p tools/input-processor-{your-format}/{src,test}
   cd tools/input-processor-{your-format}
   ```

2. **Set up package.json**:

   ```json
   {
     "name": "@api-extractor-tools/input-processor-{your-format}",
     "keywords": ["{your-format}", "change-detector:input-processor-plugin"],
     "dependencies": {
       "@api-extractor-tools/change-detector-core": "workspace:*"
     }
   }
   ```

3. **Implement the plugin**:

   ```typescript
   import type {
     InputProcessorPlugin,
     InputProcessor,
     ProcessResult,
   } from '@api-extractor-tools/change-detector-core'

   export class YourFormatProcessor implements InputProcessor {
     process(content: string, filename?: string): ProcessResult {
       // Parse your format and return symbols
       return { symbols: new Map(), errors: [] }
     }
   }

   const plugin: InputProcessorPlugin = {
     id: 'your-format',
     name: 'Your Format Input Processor',
     version: '0.1.0-alpha.0',
     extensions: ['.your-ext'],
     createProcessor: () => new YourFormatProcessor(),
   }

   export default plugin
   ```

4. **Add tests**:

   ```bash
   # Create comprehensive tests
   touch test/plugin.test.ts

   # Run tests
   pnpm test
   ```

### Documentation

For detailed plugin development guidelines, see:

- [Plugin Architecture](tools/change-detector-core/PLUGIN_ARCHITECTURE.md) - Architectural decisions and design
- [Plugin Development Guide](tools/change-detector-core/PLUGIN_DEVELOPMENT.md) - Step-by-step development guide

### Example Plugin

The TypeScript input processor (`tools/input-processor-typescript/`) is a reference implementation demonstrating:

- Plugin interface implementation
- Symbol extraction from TypeScript declarations
- Comprehensive test coverage
- Documentation and README

## Demo Site

The demo site (`tools/demo-site/`) is an interactive web application that showcases the change detection capabilities. It's useful for:

- **Testing changes** to `change-detector-core` in a browser environment
- **Demonstrating** the library's capabilities to potential users
- **Debugging** edge cases with visual feedback

### Running the Demo Site

```bash
cd tools/demo-site
pnpm dev
```

This starts a local dev server (usually at `http://localhost:5173`).

### Demo Site Features

- **Side-by-side editors** - Monaco-based TypeScript editors for old/new declarations
- **Real-time analysis** - Automatic change detection as you type
- **Example library** - Pre-loaded examples demonstrating various change scenarios
- **Shareable URLs** - State is encoded in URL parameters for easy sharing
- **LLM-friendly export** - Copy formatted analysis for use with AI assistants

### Testing the Demo Site

```bash
cd tools/demo-site

# Run tests
pnpm test

# Run tests in watch mode with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

The test suite covers component rendering, user interactions, URL encoding, and edge cases.

### Building for Production

```bash
cd tools/demo-site
pnpm build
pnpm preview  # Preview the production build locally
```

**Note**: The demo site is `private: true` and is not published to npm. It's deployed separately via GitHub Actions.

## Release Process

Releases are **semi-automated** using GitHub Actions.

### How Releases Work

1. **Contributors create changesets** in their PRs
2. When PRs are merged to `main`, the Release GitHub Action runs
3. The action creates/updates a **"Version Packages"** PR that:
   - Bumps package versions based on all accumulated changesets
   - Updates CHANGELOGs
   - Removes consumed changeset files
4. **A maintainer reviews and merges** the "Version Packages" PR
5. Upon merge, packages are **automatically published to npm**

### Current Release Mode

We're in **alpha prerelease mode**. All releases are tagged with `alpha`:

- Versions: `0.0.1-alpha.0`, `0.0.1-alpha.1`, etc.
- NPM dist-tag: `alpha`
- Install with: `npm install @api-extractor-tools/change-detector@alpha`

### Manual Release (Maintainers Only)

If needed, you can manually version and publish:

```bash
# Generate versions from changesets
pnpm version-packages

# Build and publish
pnpm release
```

**Note**: This requires `NPM_TOKEN` to be set in your environment.

### Exiting Alpha Mode (Future)

When ready for stable releases:

```bash
npx changeset pre exit
git add .changeset/pre.json
git commit -m "chore: exit alpha prerelease mode"
git push
```

## Common Commands

| Command                       | Description                              |
| ----------------------------- | ---------------------------------------- |
| `pnpm install`                | Install dependencies                     |
| `pnpm build`                  | Build all packages                       |
| `pnpm test`                   | Run all tests                            |
| `pnpm check`                  | Lint and type-check everything           |
| `pnpm format`                 | Format code with Prettier                |
| `pnpm changeset`              | Create a new changeset (manual)          |
| `pnpm changeset:auto`         | Auto-generate changeset from API changes |
| `pnpm changeset:validate`     | Validate changesets against API changes  |
| `pnpm version-packages`       | Version packages (maintainers only)      |
| `pnpm release`                | Publish packages (maintainers only)      |
| `pnpm --filter demo-site dev` | Run the demo site locally                |

## Package Structure

```text
api-extractor-tools/
├── tools/
│   ├── change-detector/                        # File-based API change detection with CLI
│   ├── change-detector-core/                   # Isomorphic core (browser + Node.js)
│   ├── change-detector-semantic-release-plugin/ # semantic-release integration
│   ├── changeset-change-detector/              # Changesets plugin for auto version bumps
│   ├── module-declaration-merger/              # Merges module declarations
│   └── demo-site/                              # Interactive web demo (private, not published)
├── .changeset/                                 # Changeset configuration and files
├── .github/workflows/                          # CI/CD workflows
└── package.json                                # Root workspace config
```

## Getting Help

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Changesets Docs**: <https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md>

## Additional Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [API Extractor](https://api-extractor.com/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Nx](https://nx.dev/)
