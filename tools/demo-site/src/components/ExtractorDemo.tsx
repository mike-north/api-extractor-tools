import { useState, useCallback, useEffect, useRef } from 'react'
import * as ts from 'typescript'
import { DtsEditor } from './DtsEditor'
import { extractorExamples, type ExtractorExample } from '../examples/extractor-examples'
import './ExtractorDemo.css'

interface ExtractorDemoProps {
  theme: 'light' | 'dark'
}

type OutputTab = 'dts' | 'virtual-fs'

/**
 * A simplified virtual filesystem for demonstrating the concept.
 * In a real Node.js environment, you would use InMemoryFileSystem from extractor-lib.
 */
class BrowserVirtualFileSystem {
  private files = new Map<string, string>()

  writeFile(path: string, content: string): void {
    this.files.set(this.normalizePath(path), content)
  }

  readFile(path: string): string | undefined {
    return this.files.get(this.normalizePath(path))
  }

  exists(path: string): boolean {
    return this.files.has(this.normalizePath(path))
  }

  getFiles(): Map<string, string> {
    return new Map(this.files)
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/')
  }
}

export function ExtractorDemo({ theme }: ExtractorDemoProps) {
  const [sourceCode, setSourceCode] = useState(extractorExamples[0].source)
  const [dtsOutput, setDtsOutput] = useState<string>('')
  const [virtualFs, setVirtualFs] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [editorHeight, setEditorHeight] = useState(350)
  const [outputTab, setOutputTab] = useState<OutputTab>('dts')
  const [selectedExample, setSelectedExample] = useState<ExtractorExample>(extractorExamples[0])

  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // Run TypeScript compilation when source changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      compileTypeScript()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [sourceCode])

  const compileTypeScript = useCallback(() => {
    setIsCompiling(true)
    setError(null)

    try {
      // Create virtual filesystem
      const fs = new BrowserVirtualFileSystem()

      // Write the source file to virtual filesystem
      fs.writeFile('/project/src/index.ts', sourceCode)

      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        declaration: true,
        emitDeclarationOnly: true,
        strict: true,
        skipLibCheck: true,
      }

      // Create source file
      const sourceFile = ts.createSourceFile(
        '/project/src/index.ts',
        sourceCode,
        ts.ScriptTarget.ES2020,
        true
      )

      // Create a compiler host that uses our virtual filesystem
      const host: ts.CompilerHost = {
        getSourceFile: (fileName) => {
          if (fileName === '/project/src/index.ts' || fileName.endsWith('index.ts')) {
            return sourceFile
          }
          return undefined
        },
        getDefaultLibFileName: () => 'lib.es2020.d.ts',
        writeFile: (fileName, content) => {
          fs.writeFile(fileName, content)
        },
        getCurrentDirectory: () => '/project',
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
        fileExists: (fileName) => {
          if (fileName === '/project/src/index.ts' || fileName.endsWith('index.ts')) {
            return true
          }
          if (fileName.includes('lib.') && fileName.endsWith('.d.ts')) {
            return true
          }
          return fs.exists(fileName)
        },
        readFile: (fileName) => {
          if (fileName === '/project/src/index.ts') {
            return sourceCode
          }
          return fs.readFile(fileName)
        },
        directoryExists: () => true,
        getDirectories: () => [],
      }

      const program = ts.createProgram(['/project/src/index.ts'], compilerOptions, host)

      // Check for compilation errors
      const diagnostics = ts.getPreEmitDiagnostics(program)
      if (diagnostics.length > 0) {
        const errors = diagnostics.map(d => {
          const message = ts.flattenDiagnosticMessageText(d.messageText, '\n')
          if (d.file && d.start !== undefined) {
            const { line, character } = d.file.getLineAndCharacterOfPosition(d.start)
            return `Line ${line + 1}, Col ${character + 1}: ${message}`
          }
          return message
        }).join('\n')
        setError(`TypeScript compilation errors:\n${errors}`)
        setDtsOutput('')
        setIsCompiling(false)
        return
      }

      // Emit declarations
      let dtsContent = ''
      program.emit(undefined, (fileName, content) => {
        if (fileName.endsWith('.d.ts')) {
          dtsContent = content
          fs.writeFile('/project/dist/index.d.ts', content)
        }
      }, undefined, true)

      if (!dtsContent) {
        setError('Failed to generate declaration file')
        setDtsOutput('')
      } else {
        setDtsOutput(dtsContent)
        setVirtualFs(fs.getFiles())
        setError(null)
      }
    } catch (err) {
      console.error('Compilation failed:', err)
      setError(err instanceof Error ? err.message : 'Compilation failed')
      setDtsOutput('')
    } finally {
      setIsCompiling(false)
    }
  }, [sourceCode])

  const handleExampleSelect = useCallback((example: ExtractorExample) => {
    setSelectedExample(example)
    setSourceCode(example.source)
  }, [])

  // Resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startY.current = e.clientY
    startHeight.current = editorHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [editorHeight])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientY - startY.current
      const newHeight = Math.max(200, Math.min(600, startHeight.current + delta))
      setEditorHeight(newHeight)
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Get output content based on selected tab
  const getOutputContent = useCallback((): string => {
    if (error) return `// Error:\n// ${error.replace(/\n/g, '\n// ')}`

    switch (outputTab) {
      case 'dts':
        return dtsOutput || '// Compiling...'
      case 'virtual-fs':
        if (virtualFs.size === 0) return '// No files in virtual filesystem yet'
        let output = '// Virtual Filesystem Contents\n// ===========================\n\n'
        for (const [path, content] of virtualFs) {
          output += `// --- ${path} ---\n`
          output += content
          output += '\n\n'
        }
        return output
      default:
        return ''
    }
  }, [dtsOutput, virtualFs, error, outputTab])

  return (
    <div className="extractor-demo">
      <div className="extractor-toolbar">
        <div className="example-selector">
          <label htmlFor="example-select">Example:</label>
          <select
            id="example-select"
            value={selectedExample.name}
            onChange={(e) => {
              const example = extractorExamples.find(ex => ex.name === e.target.value)
              if (example) handleExampleSelect(example)
            }}
          >
            {extractorExamples.map((example) => (
              <option key={example.name} value={example.name}>
                {example.name}
              </option>
            ))}
          </select>
        </div>
        <div className="extraction-status">
          {isCompiling && <span className="extracting">Compiling...</span>}
          {!isCompiling && dtsOutput && !error && (
            <span className="success">Compilation successful</span>
          )}
          {!isCompiling && error && (
            <span className="error">Compilation failed</span>
          )}
        </div>
      </div>

      <div className="extractor-description">
        {selectedExample.description}
      </div>

      <div className="extractor-editors" style={{ height: editorHeight }}>
        <div className="editor-panel">
          <div className="editor-header">TypeScript Source</div>
          <div className="editor-wrapper">
            <DtsEditor
              value={sourceCode}
              onChange={setSourceCode}
              theme={theme}
              path="file:///src/index.ts"
            />
          </div>
        </div>
        <div className="editor-panel output-panel">
          <div className="editor-header output-header">
            <div className="output-tabs">
              <button
                className={`output-tab ${outputTab === 'dts' ? 'active' : ''}`}
                onClick={() => setOutputTab('dts')}
              >
                Generated .d.ts
              </button>
              <button
                className={`output-tab ${outputTab === 'virtual-fs' ? 'active' : ''}`}
                onClick={() => setOutputTab('virtual-fs')}
              >
                Virtual Filesystem
              </button>
            </div>
          </div>
          <div className="editor-wrapper">
            <DtsEditor
              value={getOutputContent()}
              onChange={() => {}} // Read-only
              theme={theme}
              path="file:///output.d.ts"
            />
          </div>
        </div>
      </div>

      <div
        className="resize-handle"
        onMouseDown={handleMouseDown}
      >
        <div className="resize-handle-grip" />
      </div>

      <div className="extractor-info">
        <h3>Virtual Filesystem Demo</h3>
        <p>
          This demo shows how the <code>@api-extractor-tools/extractor-lib</code> package
          uses a <strong>virtual filesystem</strong> to enable API extraction without touching
          your real filesystem.
        </p>

        <h4>What you're seeing:</h4>
        <ol>
          <li><strong>TypeScript Source</strong> - Write TypeScript code with JSDoc comments and release tags</li>
          <li><strong>Virtual Filesystem</strong> - Files are stored in memory, not on disk</li>
          <li><strong>Generated .d.ts</strong> - TypeScript compiles your code to declaration files</li>
        </ol>

        <h4>In Node.js environments:</h4>
        <p>
          When running in Node.js (CLI tools, build scripts, tests), the full <code>extract()</code>
          function from <code>extractor-lib</code> takes this further:
        </p>
        <ol>
          <li>Load .d.ts files into an <code>InMemoryFileSystem</code></li>
          <li>Create a temporary directory for API Extractor to work with</li>
          <li>Run the full API Extractor analysis</li>
          <li>Capture outputs (API reports, doc models, trimmed rollups)</li>
          <li>Return everything as strings - no permanent files written</li>
        </ol>

        <div className="note">
          <strong>Why virtual filesystem?</strong> This enables API Extractor to run in
          environments without real filesystem access (testing, CI pipelines) and eliminates
          sensitivity to the current working directory.
        </div>

        <h4>Example Node.js usage:</h4>
        <pre className="code-example">{`import { extract, InMemoryFileSystem } from '@api-extractor-tools/extractor-lib';
import * as ts from 'typescript';

const fs = new InMemoryFileSystem();
fs.writeFile('/project/dist/index.d.ts', dtsContent);

const result = extract({
  mainEntryPointFilePath: '/project/dist/index.d.ts',
  packageName: 'my-package',
  compilerOptions: { /* ... */ },
  dtsRollup: { enabled: true, publicTrimmedFilePath: '/out/public.d.ts' },
  apiReport: { enabled: true, outputPath: '/out/api.md' },
}, fs, { typescript: ts });

console.log(result.outputs.dtsRollup?.public);  // Trimmed .d.ts
console.log(result.outputs.apiReport);          // API report markdown`}</pre>
      </div>
    </div>
  )
}
