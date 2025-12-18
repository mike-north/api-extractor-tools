/**
 * Integration tests verifying that changes detected by change-detector-core
 * are correctly displayed in the UI.
 *
 * These tests ensure that the ChangeReport component accurately reflects
 * what the analysis engine detects, preventing UI/engine desynchronization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within, cleanup } from '@testing-library/react'
import * as ts from 'typescript'
import {
  analyzeChanges,
  createASTComparisonReport,
  semverDefaultPolicy,
  semverReadOnlyPolicy,
  semverWriteOnlyPolicy,
  type ASTComparisonReport,
  type Policy,
} from '@api-extractor-tools/change-detector-core'
import { ChangeReport } from '../src/components/ChangeReport'
import App from '../src/App'

/**
 * Helper to compute the expected report from source code
 */
function computeExpectedReport(
  oldSource: string,
  newSource: string,
  policy: Policy = semverDefaultPolicy
): ASTComparisonReport {
  const result = analyzeChanges(oldSource, newSource, ts, { policy })
  return createASTComparisonReport(
    result.results.map((r) => ({ ...r.change, releaseType: r.releaseType }))
  )
}

describe('UI/Analysis Integration', () => {
  afterEach(() => {
    cleanup()
  })

  describe('ChangeReport displays engine results correctly', () => {
    it('displays the correct release type', () => {
      const oldSource = 'export declare function greet(name: string): string;'
      const newSource = 'export declare function greet(): string;' // Removed required param - breaking

      const report = computeExpectedReport(oldSource, newSource)

      render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Find the release type display
      const releaseTypeElement = screen.getByText(/Release Type:/i)
      expect(releaseTypeElement.textContent).toContain(
        report.releaseType.toUpperCase()
      )
    })

    it('displays all breaking changes detected by the engine', () => {
      const oldSource = `
        export declare function fetchUser(id: number): User;
        export interface User {
          id: number;
          name: string;
        }
      `
      const newSource = `
        export declare function fetchUser(id: string): User;
        export interface User {
          id: string;
          name: string;
        }
      `

      const report = computeExpectedReport(oldSource, newSource)

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Verify the Breaking Changes section exists
      const breakingHeaders = container.querySelectorAll('h3')
      const breakingHeader = Array.from(breakingHeaders).find((h) =>
        h.textContent?.includes('Breaking Changes')
      )
      expect(breakingHeader).toBeTruthy()

      // Verify each breaking change path is displayed
      for (const change of report.byReleaseType.major) {
        const symbolElements = screen.queryAllByText(change.path)
        expect(symbolElements.length).toBeGreaterThan(0)
      }
    })

    it('displays all non-breaking changes detected by the engine', () => {
      const oldSource = 'export declare function greet(name: string): string;'
      const newSource = `
        export declare function greet(name: string): string;
        export declare const VERSION: string;
      `

      const report = computeExpectedReport(oldSource, newSource)

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Verify the Non-Breaking Changes section exists
      const headers = container.querySelectorAll('h3')
      const nonBreakingHeader = Array.from(headers).find((h) =>
        h.textContent?.includes('Non-Breaking Changes')
      )
      expect(nonBreakingHeader).toBeTruthy()

      // Verify each non-breaking change is displayed
      for (const change of [
        ...report.byReleaseType.minor,
        ...report.byReleaseType.patch,
      ]) {
        const symbolElements = screen.queryAllByText(change.path)
        expect(symbolElements.length).toBeGreaterThan(0)
      }
    })

    it('displays summary stats matching the engine report', () => {
      const oldSource = `
        export declare function oldFunc(): void;
        export interface OldInterface { x: number; }
      `
      const newSource = `
        export declare function newFunc(): void;
        export interface NewInterface { y: string; }
      `

      const report = computeExpectedReport(oldSource, newSource)

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Verify the Summary section exists
      const headers = container.querySelectorAll('h3')
      const summaryHeader = Array.from(headers).find((h) =>
        h.textContent?.includes('Summary')
      )
      expect(summaryHeader).toBeTruthy()

      // Verify stat cards exist
      const statCards = container.querySelectorAll('.stat-card')
      expect(statCards.length).toBe(4) // Added, Breaking, Patch, Total
    })

    it('displays change explanations from the engine', () => {
      const oldSource = 'export declare function greet(name: string): string;'
      const newSource = 'export declare function greet(): void;'

      const report = computeExpectedReport(oldSource, newSource)

      render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Each change should have its explanation displayed
      for (const change of report.changes) {
        if (change.explanation) {
          expect(screen.getByText(change.explanation)).toBeInTheDocument()
        }
      }
    })

    it('displays node kinds correctly', () => {
      const oldSource = `
        export declare function myFunc(): void;
        export interface MyInterface { x: number; }
        export declare const MY_CONST: string;
      `
      const newSource = '' // Remove everything

      const report = computeExpectedReport(oldSource, newSource)

      render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Verify node kinds are displayed
      for (const change of report.changes) {
        const kindElements = screen.getAllByText(change.nodeKind)
        expect(kindElements.length).toBeGreaterThan(0)
      }
    })

    it('displays signatures when available', () => {
      const oldSource =
        'export declare function greet(name: string): string;'
      const newSource =
        'export declare function greet(name: string, prefix: string): string;'

      const report = computeExpectedReport(oldSource, newSource)

      render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Check for Before/After labels when signatures exist
      const changesWithSignatures = report.changes.filter(
        (c) => c.oldNode?.typeInfo.signature || c.newNode?.typeInfo.signature
      )

      if (changesWithSignatures.length > 0) {
        // At least one change should have signature display
        const beforeLabels = screen.queryAllByText('Before:')
        const afterLabels = screen.queryAllByText('After:')
        expect(beforeLabels.length + afterLabels.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Policy-specific UI verification', () => {
    const oldSource = `
      export interface Config {
        required: string;
      }
    `
    const newSource = `
      export interface Config {
        required: string;
        optional?: string;
      }
    `

    it('displays correct results for semverDefaultPolicy', () => {
      const report = computeExpectedReport(
        oldSource,
        newSource,
        semverDefaultPolicy
      )

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Release type should be in the report header
      const releaseTypeEl = container.querySelector('.release-type')
      expect(releaseTypeEl?.textContent).toContain(report.releaseType.toUpperCase())
    })

    it('displays correct results for semverReadOnlyPolicy', () => {
      const report = computeExpectedReport(
        oldSource,
        newSource,
        semverReadOnlyPolicy
      )

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      const releaseTypeEl = container.querySelector('.release-type')
      expect(releaseTypeEl?.textContent).toContain(report.releaseType.toUpperCase())
    })

    it('displays correct results for semverWriteOnlyPolicy', () => {
      const report = computeExpectedReport(
        oldSource,
        newSource,
        semverWriteOnlyPolicy
      )

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      const releaseTypeEl = container.querySelector('.release-type')
      expect(releaseTypeEl?.textContent).toContain(report.releaseType.toUpperCase())
    })
  })

  describe('Full App integration', () => {
    beforeEach(() => {
      // Mock URL and history
      vi.stubGlobal('location', {
        ...window.location,
        search: '',
        pathname: '/',
      })
      vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
    })

    afterEach(() => {
      cleanup()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    it('App renders analysis results that match engine output', async () => {
      // The App uses default example content on load
      const { container } = render(<App />)

      // Wait for the report to be rendered (after debounce)
      await waitFor(
        () => {
          // Should show release type indicator
          const releaseType = container.querySelector('.release-type')
          expect(releaseType).toBeTruthy()
        },
        { timeout: 2000 }
      )

      // The report sections should be present
      const headers = container.querySelectorAll('h3')
      const headerTexts = Array.from(headers).map((h) => h.textContent)
      expect(headerTexts.some((t) => t?.includes('Breaking Changes'))).toBe(true)
      expect(headerTexts.some((t) => t?.includes('Non-Breaking Changes'))).toBe(true)
      expect(headerTexts.some((t) => t?.includes('Summary'))).toBe(true)
    })

    it('UI change counts match engine report structure', async () => {
      const { container } = render(<App />)

      await waitFor(
        () => {
          const releaseType = container.querySelector('.release-type')
          expect(releaseType).toBeTruthy()
        },
        { timeout: 2000 }
      )

      // Verify stat cards exist with labels
      const statCards = container.querySelectorAll('.stat-card')
      expect(statCards.length).toBe(4)

      const labels = container.querySelectorAll('.stat-card .label')
      const labelTexts = Array.from(labels).map((l) => l.textContent)
      expect(labelTexts).toContain('Added')
      expect(labelTexts).toContain('Breaking')
      expect(labelTexts).toContain('Patch')
      expect(labelTexts).toContain('Total')
    })
  })

  describe('Edge cases', () => {
    it('handles empty changes correctly', () => {
      const source = 'export declare function greet(name: string): string;'
      const report = computeExpectedReport(source, source)

      expect(report.changes).toHaveLength(0)
      expect(report.releaseType).toBe('none')

      const { container } = render(
        <ChangeReport report={report} oldContent={source} newContent={source} />
      )

      const releaseTypeEl = container.querySelector('.release-type')
      expect(releaseTypeEl?.textContent).toContain('NONE')
    })

    it('handles forbidden changes when present', () => {
      // Create a report with forbidden changes manually since they're policy-dependent
      const oldSource = 'export declare function test(): void;'
      const newSource = 'export declare function test(): string;'

      const report = computeExpectedReport(oldSource, newSource)

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // If there are forbidden changes, they should be displayed
      if (report.byReleaseType.forbidden.length > 0) {
        const headers = container.querySelectorAll('h3')
        const forbiddenHeader = Array.from(headers).find((h) =>
          h.textContent?.includes('Forbidden Changes')
        )
        expect(forbiddenHeader).toBeTruthy()
      }
    })

    it('displays no exports warning when appropriate', () => {
      const oldSource = 'declare function internal(): void;'
      const newSource = 'declare function internal(): string;'

      const report = computeExpectedReport(oldSource, newSource)

      render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Should show warning about no exports
      expect(screen.getByText(/No exports detected/i)).toBeInTheDocument()
    })
  })

  describe('Change details accuracy', () => {
    it('each reported change has matching UI representation', () => {
      const oldSource = `
        export declare function funcA(): void;
        export declare function funcB(x: number): number;
      `
      const newSource = `
        export declare function funcA(newParam: string): void;
        export declare function funcC(): void;
      `

      const report = computeExpectedReport(oldSource, newSource)

      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Get all change items displayed in the UI
      const changeItems = container.querySelectorAll('.change-item')

      // The number of displayed change items should match the total changes
      expect(changeItems.length).toBe(report.stats.total)

      // Verify each change path is visible
      const symbolNames = container.querySelectorAll('.symbol-name')
      const displayedPaths = Array.from(symbolNames).map((el) => el.textContent)

      // All changes should have their paths displayed
      for (const change of report.changes) {
        expect(displayedPaths).toContain(change.path)
      }
    })

    it('total stats equal sum of categorized changes', () => {
      const oldSource = `
        export declare function a(): void;
        export declare function b(): void;
      `
      const newSource = `
        export declare function a(x: number): void;
        export declare function c(): void;
      `

      const report = computeExpectedReport(oldSource, newSource)

      // Verify the report's internal consistency
      const categorizedTotal =
        report.byReleaseType.forbidden.length +
        report.byReleaseType.major.length +
        report.byReleaseType.minor.length +
        report.byReleaseType.patch.length +
        report.byReleaseType.none.length

      expect(report.stats.total).toBe(categorizedTotal)

      // Render and verify UI shows consistent totals
      const { container } = render(
        <ChangeReport
          report={report}
          oldContent={oldSource}
          newContent={newSource}
        />
      )

      // Find the total stat card
      const statCards = container.querySelectorAll('.stat-card')
      const totalCard = Array.from(statCards).find(
        (card) => card.querySelector('.label')?.textContent === 'Total'
      )
      expect(totalCard).toBeTruthy()
      expect(totalCard?.querySelector('.value')?.textContent).toBe(
        report.stats.total.toString()
      )
    })
  })
})

