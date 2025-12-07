import { useState, useCallback, useEffect, useRef } from 'react'
import * as ts from 'typescript'
import {
  compareDeclarations,
  formatReportAsText,
  type ComparisonReport,
} from '@api-extractor-tools/change-detector-core'
import { DtsEditor } from './components/DtsEditor'
import { ChangeReport } from './components/ChangeReport'
import { BugReportModal } from './components/BugReportModal'
import { examples, type Example } from './examples'
import { encodeBase64, decodeBase64 } from './utils/encoding'
import { isUrlTooLong } from './utils/urlLimits'

type ThemePreference = 'light' | 'dark' | 'auto'
type ResolvedTheme = 'light' | 'dark'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme(): ThemePreference {
  const storedTheme = localStorage.getItem('theme') as ThemePreference | null
  if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'auto') {
    return storedTheme
  }
  return 'auto'
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
  const [themePreference, setThemePreference] = useState<ThemePreference>(getInitialTheme())
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme())
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // Resolve the actual theme to apply
  const resolvedTheme: ResolvedTheme = themePreference === 'auto' ? systemTheme : themePreference

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    // Set initial value
    handleChange(mediaQuery)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Apply resolved theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    localStorage.setItem('theme', themePreference)
  }, [resolvedTheme, themePreference])

  const handleThemeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setThemePreference(e.target.value as ThemePreference)
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
      
      // Only update URL if it's within safe length limits
      // If too long, clear the URL params to avoid issues
      if (isUrlTooLong(newUrl)) {
        window.history.replaceState(null, '', window.location.pathname)
      } else {
        window.history.replaceState(null, '', newUrl)
      }
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
  const [isBugReportOpen, setIsBugReportOpen] = useState(false)

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
          <select
            className="theme-toggle"
            value={themePreference}
            onChange={handleThemeChange}
            aria-label="Theme preference"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto (System)</option>
          </select>
          <button className="copy-button" onClick={handleCopyForLLM}>
            {copyFeedback ?? 'Copy for LLM'}
          </button>
          <button
            className="report-issue-button"
            onClick={() => setIsBugReportOpen(true)}
            disabled={!report}
            title={
              report
                ? 'Report an issue with change detection'
                : 'Run analysis first to report issues'
            }
          >
            Something Looks Wrong?
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="editors-container" style={{ height: editorHeight }}>
          <div className="editor-panel">
            <div className="editor-header">Old API (.d.ts)</div>
            <div className="editor-wrapper">
              <DtsEditor value={oldContent} onChange={setOldContent} theme={resolvedTheme} />
            </div>
          </div>
          <div className="editor-panel">
            <div className="editor-header">New API (.d.ts)</div>
            <div className="editor-wrapper">
              <DtsEditor value={newContent} onChange={setNewContent} theme={resolvedTheme} />
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

      {isBugReportOpen && (
        <BugReportModal
          report={report}
          oldContent={oldContent}
          newContent={newContent}
          onClose={() => setIsBugReportOpen(false)}
        />
      )}
    </div>
  )
}

export default App
