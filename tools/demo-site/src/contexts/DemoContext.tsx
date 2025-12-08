import { createContext, useContext, type ReactNode } from 'react'

/**
 * Capabilities that a demo can provide.
 */
export interface DemoCapabilities {
  /**
   * Get content formatted for LLM consumption.
   * Should return markdown-formatted text with the demo state.
   */
  getLLMContent: () => string
  
  /**
   * Open the bug report modal.
   * Should allow users to report issues with the demo.
   */
  openBugReport: () => void
  
  /**
   * Check if bug reporting is currently available.
   * For example, might be disabled if no analysis has been run yet.
   */
  canReportBug: boolean
}

const DemoContext = createContext<DemoCapabilities | undefined>(undefined)

interface DemoProviderProps {
  capabilities: DemoCapabilities
  children: ReactNode
}

/**
 * Provider component that makes demo capabilities available to child components.
 */
export function DemoProvider({ capabilities, children }: DemoProviderProps) {
  return (
    <DemoContext.Provider value={capabilities}>
      {children}
    </DemoContext.Provider>
  )
}

/**
 * Hook to access demo capabilities.
 * Must be used within a DemoProvider.
 */
export function useDemoCapabilities(): DemoCapabilities {
  const context = useContext(DemoContext)
  if (context === undefined) {
    throw new Error('useDemoCapabilities must be used within a DemoProvider')
  }
  return context
}
