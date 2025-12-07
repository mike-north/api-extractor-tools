import Editor from '@monaco-editor/react'

interface DtsEditorProps {
  value: string
  onChange: (value: string) => void
}

export function DtsEditor({ value, onChange }: DtsEditorProps) {
  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      theme="vs-dark"
      value={value}
      onChange={(val) => onChange(val ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 12 },
      }}
    />
  )
}
