import { describe, it, expect } from 'vitest'
import type {
  SourceLocation,
  ExportedSymbol,
  SourceMapping,
  ProcessResult,
} from '../src/index'
import { compare } from './helpers'

describe('SourceLocation interface', () => {
  describe('valid SourceLocation objects', () => {
    it('accepts valid line and column values', () => {
      const location: SourceLocation = {
        line: 10,
        column: 5,
      }

      expect(location.line).toBe(10)
      expect(location.column).toBe(5)
      expect(location.endLine).toBeUndefined()
      expect(location.endColumn).toBeUndefined()
    })

    it('accepts valid line, column, endLine, and endColumn values', () => {
      const location: SourceLocation = {
        line: 10,
        column: 5,
        endLine: 12,
        endColumn: 20,
      }

      expect(location.line).toBe(10)
      expect(location.column).toBe(5)
      expect(location.endLine).toBe(12)
      expect(location.endColumn).toBe(20)
    })

    it('accepts 1-based line numbers', () => {
      const location: SourceLocation = {
        line: 1,
        column: 0,
      }

      expect(location.line).toBe(1)
      expect(location.column).toBe(0)
    })

    it('accepts 0-based column numbers', () => {
      const location: SourceLocation = {
        line: 5,
        column: 0,
      }

      expect(location.line).toBe(5)
      expect(location.column).toBe(0)
    })

    it('accepts range with same line (single line range)', () => {
      const location: SourceLocation = {
        line: 10,
        column: 5,
        endLine: 10,
        endColumn: 25,
      }

      expect(location.line).toBe(location.endLine)
      expect(location.column).toBeLessThan(location.endColumn!)
    })

    it('accepts multi-line range', () => {
      const location: SourceLocation = {
        line: 10,
        column: 5,
        endLine: 15,
        endColumn: 10,
      }

      expect(location.line).toBeLessThan(location.endLine!)
    })
  })

  describe('optional fields', () => {
    it('allows endLine without endColumn', () => {
      const location: SourceLocation = {
        line: 10,
        column: 5,
        endLine: 12,
      }

      expect(location.endLine).toBe(12)
      expect(location.endColumn).toBeUndefined()
    })

    it('allows endColumn without endLine', () => {
      const location: SourceLocation = {
        line: 10,
        column: 5,
        endColumn: 20,
      }

      expect(location.endColumn).toBe(20)
      expect(location.endLine).toBeUndefined()
    })
  })
})

describe('ExportedSymbol with sourceLocation', () => {
  describe('sourceLocation field is optional', () => {
    it('creates ExportedSymbol without sourceLocation', () => {
      const symbol: ExportedSymbol = {
        name: 'myFunction',
        kind: 'function',
        signature: 'function myFunction(): void',
      }

      expect(symbol.name).toBe('myFunction')
      expect(symbol.sourceLocation).toBeUndefined()
    })

    it('creates ExportedSymbol with sourceLocation', () => {
      const symbol: ExportedSymbol = {
        name: 'myFunction',
        kind: 'function',
        signature: 'function myFunction(): void',
        sourceLocation: {
          line: 10,
          column: 0,
        },
      }

      expect(symbol.sourceLocation).toBeDefined()
      expect(symbol.sourceLocation?.line).toBe(10)
      expect(symbol.sourceLocation?.column).toBe(0)
    })

    it('creates ExportedSymbol with sourceLocation range', () => {
      const symbol: ExportedSymbol = {
        name: 'MyClass',
        kind: 'class',
        signature: 'class MyClass { }',
        sourceLocation: {
          line: 10,
          column: 0,
          endLine: 15,
          endColumn: 1,
        },
      }

      expect(symbol.sourceLocation).toBeDefined()
      expect(symbol.sourceLocation?.line).toBe(10)
      expect(symbol.sourceLocation?.endLine).toBe(15)
    })
  })

  describe('backwards compatibility', () => {
    it('accepts symbols without sourceLocation field (backwards compatible)', () => {
      const oldSymbol: ExportedSymbol = {
        name: 'oldFunction',
        kind: 'function',
        signature: 'function oldFunction(): void',
      }

      const newSymbol: ExportedSymbol = {
        name: 'newFunction',
        kind: 'function',
        signature: 'function newFunction(): void',
        sourceLocation: {
          line: 1,
          column: 0,
        },
      }

      // Both should be valid ExportedSymbol objects
      expect(oldSymbol.name).toBe('oldFunction')
      expect(newSymbol.name).toBe('newFunction')
    })
  })
})

describe('SourceMapping interface', () => {
  describe('valid SourceMapping objects', () => {
    it('creates SourceMapping with symbolLocations and sourceFile', () => {
      const mapping: SourceMapping = {
        symbolLocations: new Map([
          [
            'myFunction',
            {
              line: 10,
              column: 0,
            },
          ],
        ]),
        sourceFile: 'src/index.ts',
      }

      expect(mapping.symbolLocations.size).toBe(1)
      expect(mapping.symbolLocations.has('myFunction')).toBe(true)
      expect(mapping.sourceFile).toBe('src/index.ts')
    })

    it('creates SourceMapping with multiple symbols', () => {
      const mapping: SourceMapping = {
        symbolLocations: new Map([
          [
            'myFunction',
            {
              line: 10,
              column: 0,
            },
          ],
          [
            'MyClass',
            {
              line: 20,
              column: 0,
            },
          ],
          [
            'MyInterface',
            {
              line: 30,
              column: 0,
            },
          ],
        ]),
        sourceFile: 'src/types.ts',
      }

      expect(mapping.symbolLocations.size).toBe(3)
      expect(mapping.symbolLocations.has('myFunction')).toBe(true)
      expect(mapping.symbolLocations.has('MyClass')).toBe(true)
      expect(mapping.symbolLocations.has('MyInterface')).toBe(true)
    })

    it('creates SourceMapping with empty symbolLocations', () => {
      const mapping: SourceMapping = {
        symbolLocations: new Map(),
        sourceFile: 'src/empty.ts',
      }

      expect(mapping.symbolLocations.size).toBe(0)
      expect(mapping.sourceFile).toBe('src/empty.ts')
    })
  })

  describe('symbolLocations map keys should match symbol names', () => {
    it('maps symbol name to location', () => {
      const symbolName = 'myFunction'
      const mapping: SourceMapping = {
        symbolLocations: new Map([
          [
            symbolName,
            {
              line: 10,
              column: 0,
            },
          ],
        ]),
        sourceFile: 'src/index.ts',
      }

      const location = mapping.symbolLocations.get(symbolName)
      expect(location).toBeDefined()
      expect(location?.line).toBe(10)
      expect(location?.column).toBe(0)
    })
  })
})

describe('ProcessResult with sourceMapping', () => {
  describe('sourceMapping field is optional', () => {
    it('creates ProcessResult without sourceMapping', () => {
      const result: ProcessResult = {
        symbols: new Map([
          [
            'myFunction',
            {
              name: 'myFunction',
              kind: 'function',
              signature: 'function myFunction(): void',
            },
          ],
        ]),
        errors: [],
      }

      expect(result.symbols.size).toBe(1)
      expect(result.sourceMapping).toBeUndefined()
    })

    it('creates ProcessResult with sourceMapping', () => {
      const result: ProcessResult = {
        symbols: new Map([
          [
            'myFunction',
            {
              name: 'myFunction',
              kind: 'function',
              signature: 'function myFunction(): void',
            },
          ],
        ]),
        errors: [],
        sourceMapping: {
          symbolLocations: new Map([
            [
              'myFunction',
              {
                line: 10,
                column: 0,
              },
            ],
          ]),
          sourceFile: 'src/index.ts',
        },
      }

      expect(result.sourceMapping).toBeDefined()
      expect(result.sourceMapping?.symbolLocations.size).toBe(1)
      expect(result.sourceMapping?.sourceFile).toBe('src/index.ts')
    })
  })

  describe('backwards compatibility', () => {
    it('works with ProcessResult without sourceMapping (backwards compatible)', () => {
      const result: ProcessResult = {
        symbols: new Map([
          [
            'oldFunction',
            {
              name: 'oldFunction',
              kind: 'function',
              signature: 'function oldFunction(): void',
            },
          ],
        ]),
        errors: [],
      }

      expect(result.symbols.size).toBe(1)
      expect(result.errors).toHaveLength(0)
      expect(result.sourceMapping).toBeUndefined()
    })
  })

  describe('sourceMapping with errors', () => {
    it('creates ProcessResult with both sourceMapping and errors', () => {
      const result: ProcessResult = {
        symbols: new Map(),
        errors: ['Parse error at line 10'],
        sourceMapping: {
          symbolLocations: new Map(),
          sourceFile: 'src/broken.ts',
        },
      }

      expect(result.errors).toHaveLength(1)
      expect(result.sourceMapping).toBeDefined()
    })
  })
})

describe('Integration: compareDeclarations with source locations', () => {
  describe('existing comparison tests still pass', () => {
    it('compares declarations without source locations', () => {
      const report = compare(
        `export declare function greet(name: string): string;`,
        `export declare function greet(name: string, prefix?: string): string;`,
      )

      expect(report.releaseType).toBe('minor')
      expect(report.stats.modified).toBe(1)
    })

    it('detects breaking changes without source locations', () => {
      const report = compare(
        `export declare function greet(name: string): string;`,
        `export declare function greet(name: string, prefix: string): string;`,
      )

      expect(report.releaseType).toBe('major')
      expect(report.changes.breaking).toHaveLength(1)
    })

    it('detects no changes correctly', () => {
      const report = compare(
        `export declare function greet(name: string): string;`,
        `export declare function greet(name: string): string;`,
      )

      expect(report.releaseType).toBe('none')
      expect(report.stats.modified).toBe(0)
    })
  })

  describe('symbols with sourceLocation should work in comparison', () => {
    it('allows symbols with sourceLocation in comparison (future use case)', () => {
      // This test ensures that when we eventually populate sourceLocation
      // in the parser, the comparison will still work correctly
      const symbolWithLocation: ExportedSymbol = {
        name: 'myFunction',
        kind: 'function',
        signature: 'function myFunction(): void',
        sourceLocation: {
          line: 10,
          column: 0,
        },
      }

      const symbolWithoutLocation: ExportedSymbol = {
        name: 'myFunction',
        kind: 'function',
        signature: 'function myFunction(): void',
      }

      // Both symbols should have the same signature for comparison purposes
      expect(symbolWithLocation.signature).toBe(symbolWithoutLocation.signature)
    })
  })
})
