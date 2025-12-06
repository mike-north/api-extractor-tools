# Development Guide

This guide explains how to develop, test, and contribute to the api-extractor-tools monorepo.

This is a **pnpm workspace monorepo** managed with [Nx](https://nx.dev/) for task orchestration and [Changesets](https://github.com/changesets/changesets) for versioning and releases.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Working with Changesets](#working-with-changesets)
- [Testing](#testing)
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
   - `tools/change-detector/` - API change detection tool
   - `tools/module-declaration-merger/` - Module declaration merger tool

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

## Working with Changesets

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every PR that changes package functionality must include a changeset.

### What is a Changeset?

A changeset is a markdown file that describes:
- Which package(s) changed
- The type of change (major/minor/patch)
- A human-readable description of what changed

### Creating a Changeset

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
```
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

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `test:` - Adding tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

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

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm check` | Lint and type-check everything |
| `pnpm format` | Format code with Prettier |
| `pnpm changeset` | Create a new changeset |
| `pnpm version-packages` | Version packages (maintainers only) |
| `pnpm release` | Publish packages (maintainers only) |

## Package Structure

```
api-extractor-tools/
├── tools/
│   ├── change-detector/          # Detects API changes
│   │   ├── src/                  # Source code
│   │   ├── test/                 # Tests
│   │   ├── dist/                 # Built output
│   │   └── package.json
│   └── module-declaration-merger/ # Merges module declarations
│       ├── src/
│       ├── test/
│       ├── dist/
│       └── package.json
├── .changeset/                   # Changeset configuration and files
├── .github/workflows/            # CI/CD workflows
└── package.json                  # Root workspace config
```

## Getting Help

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Changesets Docs**: https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md

## Additional Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [API Extractor](https://api-extractor.com/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Nx](https://nx.dev/)

