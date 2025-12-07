/**
 * Monaco Editor themes inspired by Gruvbox
 *
 * Based on the Gruvbox color scheme by Pavel Pertsev (morhetz)
 * @see https://github.com/morhetz/gruvbox
 *
 * Gruvbox is used under the MIT License
 */

interface IStandaloneThemeData {
  base: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light'
  inherit: boolean
  rules: Array<{
    token: string
    foreground?: string
    background?: string
    fontStyle?: string
  }>
  colors: Record<string, string>
}

/**
 * Gruvbox Light theme for Monaco Editor
 * Based on the gruvbox color palette
 */
export const gruvboxLight: IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '928374', fontStyle: 'italic' },
    { token: 'keyword', foreground: '9d0006' },
    { token: 'string', foreground: '79740e' },
    { token: 'number', foreground: '8f3f71' },
    { token: 'type', foreground: 'b57614' },
    { token: 'class', foreground: 'b57614' },
    { token: 'function', foreground: '427b58' },
    { token: 'variable', foreground: '076678' },
    { token: 'constant', foreground: '8f3f71' },
    { token: 'operator', foreground: 'd65d0e' },
  ],
  colors: {
    'editor.background': '#fbf1c7',
    'editor.foreground': '#282828',
    'editor.lineHighlightBackground': '#ebdbb2',
    'editor.selectionBackground': '#d5c4a180',
    'editorCursor.foreground': '#282828',
    'editorWhitespace.foreground': '#d5c4a180',
    'editorLineNumber.foreground': '#928374',
    'editorLineNumber.activeForeground': '#3c3836',
  },
}

/**
 * Gruvbox Dark theme for Monaco Editor
 * Based on the gruvbox color palette
 */
export const gruvboxDark: IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '928374', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'fb4934' },
    { token: 'string', foreground: 'b8bb26' },
    { token: 'number', foreground: 'd3869b' },
    { token: 'type', foreground: 'fabd2f' },
    { token: 'class', foreground: 'fabd2f' },
    { token: 'function', foreground: '8ec07c' },
    { token: 'variable', foreground: '83a598' },
    { token: 'constant', foreground: 'd3869b' },
    { token: 'operator', foreground: 'fe8019' },
  ],
  colors: {
    'editor.background': '#282828',
    'editor.foreground': '#ebdbb2',
    'editor.lineHighlightBackground': '#3c3836',
    'editor.selectionBackground': '#504945',
    'editorCursor.foreground': '#ebdbb2',
    'editorWhitespace.foreground': '#50494580',
    'editorLineNumber.foreground': '#665c54',
    'editorLineNumber.activeForeground': '#d5c4a1',
  },
}
