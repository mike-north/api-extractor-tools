import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import * as ts from 'typescript'
import {
  analyzeChanges,
  formatASTReportAsText,
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
  type ASTComparisonReport,
  type Policy,
  createASTComparisonReport,
} from '@api-extractor-tools/change-detector-core'
import { DtsEditor } from './components/DtsEditor'
import { ChangeReport } from './components/ChangeReport'
import { BugReportModal } from './components/BugReportModal'
import { AppSettingsMenu } from './components/AppSettingsMenu'
import { DemoSettingsMenu } from './components/DemoSettingsMenu'
import { CustomPolicyModal } from './components/CustomPolicyModal'
import { ExportLinkages } from './components/ExportLinkages'
import { DemoProvider, type DemoCapabilities } from './contexts/DemoContext'
import { examples, type Example } from './examples'
import { encodeBase64, decodeBase64 } from './utils/encoding'
import { isUrlTooLong } from './utils/urlLimits'
import { type PolicyName } from './types'
import type { SerializablePolicy } from './types/custom-policy'
import {
  deserializePolicy,
  encodePolicyToUrl,
  decodePolicyFromUrl,
} from './utils/policySerializer'

type ThemePreference = 'light' | 'dark' | 'auto'
type ResolvedTheme = 'light' | 'dark'

const turnkeyPolicies: Record<Exclude<PolicyName, 'custom'>, Policy> = {
  'default': semverDefaultPolicy,
  'read-only': semverReadOnlyPolicy,
  'write-only': semverWriteOnlyPolicy,
}

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

function getInitialPolicy(): PolicyName {
  const params = new URLSearchParams(window.location.search)
  const policyParam = params.get('policy')
  if (policyParam === 'default' || policyParam === 'read-only' || policyParam === 'write-only' || policyParam === 'custom') {
    return policyParam
  }
  return 'default'
}

function getInitialCustomPolicy(): SerializablePolicy | null {
  const params = new URLSearchParams(window.location.search)
  const customPolicyParam = params.get('customPolicy')
  if (customPolicyParam) {
    return decodePolicyFromUrl(customPolicyParam)
  }
  return null
}

const initialContent = getInitialContent()

function App() {
  const [oldContent, setOldContent] = useState(initialContent.old)
  const [newContent, setNewContent] = useState(initialContent.new)
  const [report, setReport] = useState<ASTComparisonReport | null>(null)
  const [editorHeight, setEditorHeight] = useState(250)
  const [themePreference, setThemePreference] = useState<ThemePreference>(getInitialTheme())
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme())
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyName>(getInitialPolicy())
  const [customPolicy, setCustomPolicy] = useState<SerializablePolicy | null>(getInitialCustomPolicy())
  const [isCustomPolicyModalOpen, setIsCustomPolicyModalOpen] = useState(false)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // Memoize the resolved policy to use for analysis
  const resolvedPolicy = useMemo((): Policy => {
    if (selectedPolicy === 'custom' && customPolicy) {
      return deserializePolicy(customPolicy)
    }
    // Fall back to default if custom is selected but no policy is defined
    if (selectedPolicy === 'custom') {
      return turnkeyPolicies['default']
    }
    return turnkeyPolicies[selectedPolicy]
  }, [selectedPolicy, customPolicy])

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

  const handleThemeChange = useCallback((theme: ThemePreference) => {
    setThemePreference(theme)
  }, [])

  const handlePolicyChange = useCallback((policy: PolicyName) => {
    setSelectedPolicy(policy)
  }, [])

  const handleEditCustomPolicy = useCallback(() => {
    setIsCustomPolicyModalOpen(true)
  }, [])

  const handleSaveCustomPolicy = useCallback((policy: SerializablePolicy) => {
    setCustomPolicy(policy)
    setSelectedPolicy('custom')
    setIsCustomPolicyModalOpen(false)
  }, [])

  const handleCloseCustomPolicyModal = useCallback(() => {
    setIsCustomPolicyModalOpen(false)
  }, [])

  // Auto-analyze with 100ms debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const result = analyzeChanges(oldContent, newContent, ts, {
        policy: resolvedPolicy,
      })
      // Convert to ASTComparisonReport format
      const astReport = createASTComparisonReport(
        result.results.map(r => ({ ...r.change, releaseType: r.releaseType }))
      )
      setReport(astReport)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [oldContent, newContent, resolvedPolicy])

  // Update URL with debounce when content or policy changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams()
      params.set('old', encodeBase64(oldContent))
      params.set('new', encodeBase64(newContent))
      params.set('policy', selectedPolicy)

      // Include custom policy in URL if present
      if (selectedPolicy === 'custom' && customPolicy) {
        params.set('customPolicy', encodePolicyToUrl(customPolicy))
      }

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
  }, [oldContent, newContent, selectedPolicy, customPolicy])

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startY.current = e.clientY
    startHeight.current = editorHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [editorHeight])

  // Handle keyboard resize
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 10
    let newHeight = editorHeight

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        newHeight = Math.max(150, editorHeight - step)
        break
      case 'ArrowDown':
        e.preventDefault()
        newHeight = Math.min(800, editorHeight + step)
        break
      case 'Home':
        e.preventDefault()
        newHeight = 150
        break
      case 'End':
        e.preventDefault()
        newHeight = 800
        break
      default:
        return
    }

    setEditorHeight(newHeight)
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

  const handleExampleSelect = useCallback(
    (example: Example) => {
      setOldContent(example.old)
      setNewContent(example.new)
    },
    [],
  )

  const [isBugReportOpen, setIsBugReportOpen] = useState(false)

  const getLLMContent = useCallback(() => {
    return `## Old API (.d.ts)

\`\`\`typescript
${oldContent}
\`\`\`

## New API (.d.ts)

\`\`\`typescript
${newContent}
\`\`\`

## Versioning Policy

**Selected Policy**: ${selectedPolicy}

## Analysis Result

${report ? formatASTReportAsText(report) : 'No analysis available'}
`
  }, [oldContent, newContent, selectedPolicy, report])

  const demoCapabilities: DemoCapabilities = useMemo(() => ({
    getLLMContent,
    openBugReport: () => setIsBugReportOpen(true),
    canReportBug: report !== null,
  }), [getLLMContent, report])

  return (
    <DemoProvider capabilities={demoCapabilities}>
      <div className="app">
        <header className="header">
          <h1>
            <span>API Extractor Tools</span> Demo
          </h1>
          <div className="controls">
            <DemoSettingsMenu
              selectedPolicy={selectedPolicy}
              onPolicyChange={handlePolicyChange}
              onExampleSelect={handleExampleSelect}
              onEditCustomPolicy={handleEditCustomPolicy}
            />
            <AppSettingsMenu
              themePreference={themePreference}
              onThemeChange={handleThemeChange}
            />
          </div>
        </header>

        <main className="main-content">
          <div className="editors-container" style={{ height: editorHeight }}>
            <div className="editor-panel">
              <div className="editor-header">Old API (.d.ts)</div>
              <div className="editor-wrapper">
                <DtsEditor value={oldContent} onChange={setOldContent} theme={resolvedTheme} path="file:///old.d.ts" />
              </div>
            </div>
            <div className="editor-panel">
              <div className="editor-header">New API (.d.ts)</div>
              <div className="editor-wrapper">
                <DtsEditor value={newContent} onChange={setNewContent} theme={resolvedTheme} path="file:///new.d.ts" />
              </div>
            </div>
          </div>

          <div
            className="resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={editorHeight}
            aria-valuemin={150}
            aria-valuemax={800}
            aria-label="Editor height resize handle"
            title="Drag to resize or use arrow keys"
            tabIndex={0}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
          >
            <div className="resize-handle-grip" />
          </div>

          <div className="report-container">
            <ExportLinkages oldContent={oldContent} newContent={newContent} />
            {report ? (
              <ChangeReport report={report} oldContent={oldContent} newContent={newContent} />
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
            policyName={selectedPolicy}
            onClose={() => setIsBugReportOpen(false)}
          />
        )}

        {isCustomPolicyModalOpen && (
          <CustomPolicyModal
            initialPolicy={customPolicy}
            onSave={handleSaveCustomPolicy}
            onClose={handleCloseCustomPolicyModal}
          />
        )}

        <footer className="app-footer">
          <a
            href={`https://github.com/mike-north/api-extractor-tools/commit/${__BUILD_ID__}`}
            target="_blank"
            rel="noopener noreferrer"
            className="build-link"
          >
            Build: <code>{__BUILD_ID__}</code>
          </a>
        </footer>
      </div>
    </DemoProvider>
  )
}

export default App
