import { useState, useCallback, useEffect, useRef } from 'react'
import * as ts from 'typescript'
import {
  compareDeclarations,
  formatReportAsText,
  type ComparisonReport,
} from '@api-extractor-tools/change-detector-core'
import { DtsEditor } from './components/DtsEditor'
import { ChangeReport } from './components/ChangeReport'
import { examples, type Example } from './examples'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem('theme') as Theme | null
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

// Helper functions for base64 URL encoding (using modern TextEncoder/TextDecoder)
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function decodeBase64(str: string): string {
  try {
    const binary = atob(str)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function getInitialContent(): { old: string; new: string } {
  const params = new URLSearchParams(window.location.search)
  const oldParam = params.get('old')
  const newParam = params.get('new')

  if (oldParam && newParam) {
    const oldDecoded = decodeBase64(oldParam)
    const newDecoded = decodeBase64(newParam)
    if (oldDecoded && newDecoded) {
      return { old: oldDecoded, new: newDecoded }
    }
  }
  return { old: examples[0].old, new: examples[0].new }
}

const initialContent = getInitialContent()

function App() {
  const [oldContent, setOldContent] = useState(initialContent.old)
  const [newContent, setNewContent] = useState(initialContent.new)
  const [report, setReport] = useState<ComparisonReport | null>(null)
  const [editorHeight, setEditorHeight] = useState(250)
  const [theme, setTheme] = useState<Theme>(getInitialTheme())
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'))
  }, [])

  // Auto-analyze with 100ms debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const result = compareDeclarations(
        {
          oldContent,
          newContent,
        },
        ts,
      )
      setReport(result)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [oldContent, newContent])

  // Update URL with debounce when content changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('old', encodeBase64(oldContent))
      params.set('new', encodeBase64(newContent))
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState(null, '', newUrl)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [oldContent, newContent])

  // Handle resize drag
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
      const newHeight = Math.max(150, Math.min(800, startHeight.current + delta))
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

  const handleExampleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const example = examples.find((ex) => ex.name === e.target.value)
      if (example) {
        setOldContent(example.old)
        setNewContent(example.new)
      }
    },
    [],
  )

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const handleCopyForLLM = useCallback(() => {
    const text = `## Old API (.d.ts)

\`\`\`typescript
${oldContent}
\`\`\`

## New API (.d.ts)

\`\`\`typescript
${newContent}
\`\`\`

## Analysis Result

${report ? formatReportAsText(report) : 'No analysis available'}
`
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback('Copied!')
      setTimeout(() => setCopyFeedback(null), 2000)
    }).catch(() => {
      setCopyFeedback('Failed to copy')
      setTimeout(() => setCopyFeedback(null), 2000)
    })
  }, [oldContent, newContent, report])

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span>API Extractor Tools</span> Demo
        </h1>
        <div className="controls">
          <select
            className="example-select"
            value=""
            onChange={handleExampleChange}
          >
            <option value="" disabled>
              Load example...
            </option>
            {examples.map((example: Example) => (
              <option key={example.name} value={example.name}>
                {example.name}
              </option>
            ))}
          </select>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <button className="copy-button" onClick={handleCopyForLLM}>
            {copyFeedback ?? 'Copy for LLM'}
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="editors-container" style={{ height: editorHeight }}>
          <div className="editor-panel">
            <div className="editor-header">Old API (.d.ts)</div>
            <div className="editor-wrapper">
              <DtsEditor value={oldContent} onChange={setOldContent} theme={theme} />
            </div>
          </div>
          <div className="editor-panel">
            <div className="editor-header">New API (.d.ts)</div>
            <div className="editor-wrapper">
              <DtsEditor value={newContent} onChange={setNewContent} theme={theme} />
            </div>
          </div>
        </div>

        <div
          className="resize-handle"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        >
          <div className="resize-handle-grip" />
        </div>

        <div className="report-container">
          {report ? (
            <ChangeReport report={report} />
          ) : (
            <div className="empty-state">
              Edit the declarations above to see the comparison report
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
