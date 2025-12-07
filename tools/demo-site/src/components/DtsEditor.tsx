import Editor, { type Monaco } from '@monaco-editor/react'
import { gruvboxLight, gruvboxDark } from '../themes/gruvbox'

interface DtsEditorProps {
  value: string
  onChange: (value: string) => void
  theme: 'light' | 'dark'
}

export function DtsEditor({ value, onChange, theme }: DtsEditorProps) {
  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme('gruvbox-light', gruvboxLight)
    monaco.editor.defineTheme('gruvbox-dark', gruvboxDark)
  }

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      theme={theme === 'light' ? 'gruvbox-light' : 'gruvbox-dark'}
      value={value}
      onChange={(val) => onChange(val ?? '')}
      beforeMount={handleEditorWillMount}
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
