import { EXAMPLES } from '../examples/examples'
import './ExamplePicker.css'

export interface Example {
  name: string
  description: string
  old: string
  new: string
  expectedRelease: 'major' | 'minor' | 'patch' | 'none'
}

interface ExamplePickerProps {
  onSelect: (example: Example) => void
}

export function ExamplePicker({ onSelect }: ExamplePickerProps) {
  return (
    <div className="example-picker">
      <label htmlFor="example-select">Example:</label>
      <select
        id="example-select"
        onChange={(e) => {
          const example = EXAMPLES.find((ex) => ex.name === e.target.value)
          if (example) {
            onSelect(example)
          }
        }}
        defaultValue=""
      >
        <option value="" disabled>
          Select an example...
        </option>
        {EXAMPLES.map((example) => (
          <option key={example.name} value={example.name}>
            {example.name} ({example.expectedRelease})
          </option>
        ))}
      </select>
    </div>
  )
}
