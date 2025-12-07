import { useState, useCallback } from 'react'
import * as ts from 'typescript'
import {
  compareDeclarations,
  type ComparisonReport,
} from '@api-extractor-tools/change-detector-core'
import { DtsEditor } from './components/DtsEditor'
import { ChangeReport } from './components/ChangeReport'
import { examples, type Example } from './examples'

function App() {
  const [oldContent, setOldContent] = useState(examples[0].old)
  const [newContent, setNewContent] = useState(examples[0].new)
  const [report, setReport] = useState<ComparisonReport | null>(null)
  const [selectedExample, setSelectedExample] = useState(examples[0].name)

  const handleAnalyze = useCallback(() => {
    const result = compareDeclarations(
      {
        oldContent,
        newContent,
      },
      ts,
    )
    setReport(result)
  }, [oldContent, newContent])

  const handleExampleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const example = examples.find((ex) => ex.name === e.target.value)
      if (example) {
        setSelectedExample(example.name)
        setOldContent(example.old)
        setNewContent(example.new)
        setReport(null)
      }
    },
    [],
  )

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span>API Extractor Tools</span> Demo
        </h1>
        <div className="controls">
          <select
            className="example-select"
            value={selectedExample}
            onChange={handleExampleChange}
          >
            {examples.map((example: Example) => (
              <option key={example.name} value={example.name}>
                {example.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="main-content">
        <div className="editors-container">
          <div className="editor-panel">
            <div className="editor-header">Old API (.d.ts)</div>
            <div className="editor-wrapper">
              <DtsEditor value={oldContent} onChange={setOldContent} />
            </div>
          </div>
          <div className="editor-panel">
            <div className="editor-header">New API (.d.ts)</div>
            <div className="editor-wrapper">
              <DtsEditor value={newContent} onChange={setNewContent} />
            </div>
          </div>
        </div>

        <button className="analyze-button" onClick={handleAnalyze}>
          Analyze Changes
        </button>

        <div className="report-container">
          {report ? (
            <ChangeReport report={report} />
          ) : (
            <div className="empty-state">
              Click "Analyze Changes" to see the comparison report
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
