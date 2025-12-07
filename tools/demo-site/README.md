# API Extractor Tools Demo Site

A React-based demo application that showcases the `@api-extractor-tools/change-detector-core` library. This interactive tool allows users to compare TypeScript declaration files and visualize breaking and non-breaking changes.

## Features

- **Side-by-side TypeScript editor** - Compare old and new API declarations
- **Real-time analysis** - Automatic change detection with debouncing
- **Example library** - Pre-loaded examples demonstrating various change types
- **Shareable URLs** - State is encoded in URL parameters for easy sharing
- **LLM-friendly export** - Copy formatted analysis results for use with AI assistants
- **Resizable interface** - Adjustable editor height for optimal viewing

## Development

### Installation

```bash
pnpm install
```

### Running locally

```bash
pnpm dev
```

### Building

```bash
pnpm build
```

### Testing

The demo site includes comprehensive UI tests to protect against regressions:

```bash
# Run all tests
pnpm test

# Run tests in watch mode (requires vitest UI)
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## Test Coverage

The test suite includes:

- **Component rendering tests** - Verifies all UI elements are properly rendered
- **Example selection tests** - Ensures examples load and switch correctly
- **Content editing tests** - Validates user input and editor interactions
- **URL encoding tests** - Confirms state persistence via URL parameters
- **Copy functionality tests** - Verifies clipboard operations and feedback
- **Resize functionality tests** - Tests drag-to-resize behavior
- **Analysis report tests** - Ensures change detection works correctly
- **Edge case tests** - Handles invalid input, rapid changes, and long content

## Technology Stack

- **React 18** - UI framework
- **TypeScript 5.8** - Type safety
- **Vite** - Build tool and dev server
- **Monaco Editor** - Code editor component
- **Vitest** - Test runner
- **React Testing Library** - Component testing
- **@api-extractor-tools/change-detector-core** - Core analysis engine
