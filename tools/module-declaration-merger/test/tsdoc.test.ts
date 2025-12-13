import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import { extractModuleAugmentations } from '@'

describe('TSDoc comment preservation', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(() => {
    project.dispose()
  })

  it('preserves multi-line descriptions', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /**
   * This is a multi-line description
   * that spans several lines.
   * 
   * It even has blank lines.
   * 
   * @public
   */
  interface MyInterface {}
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    const text = result.augmentations[0]?.declarations[0]?.text ?? ''
    expect(text).toContain('This is a multi-line description')
    expect(text).toContain('that spans several lines')
    expect(text).toContain('It even has blank lines')
  })

  it('preserves @param and @returns tags', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /**
   * Calculates the sum of two numbers.
   * @param a - The first number
   * @param b - The second number
   * @returns The sum of a and b
   * @public
   */
  function add(a: number, b: number): number;
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    const text = result.augmentations[0]?.declarations[0]?.text ?? ''
    expect(text).toContain('@param a - The first number')
    expect(text).toContain('@param b - The second number')
    expect(text).toContain('@returns The sum of a and b')
  })

  it('preserves @example tags with code blocks', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /**
   * Creates a greeter.
   * 
   * @example
   * \`\`\`ts
   * const greeter = createGreeter("World");
   * greeter.greet(); // "Hello, World!"
   * \`\`\`
   * 
   * @public
   */
  function createGreeter(name: string): { greet(): string };
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    const text = result.augmentations[0]?.declarations[0]?.text ?? ''
    expect(text).toContain('@example')
    expect(text).toContain('createGreeter("World")')
  })

  it('preserves @see and @remarks tags', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /**
   * Process data with specific handling.
   * 
   * @remarks
   * This method uses a specialized algorithm that
   * provides optimal performance for large datasets.
   * 
   * @see {@link OtherClass} for alternative approaches
   * 
   * @public
   */
  function processData(data: unknown[]): void;
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    const text = result.augmentations[0]?.declarations[0]?.text ?? ''
    expect(text).toContain('@remarks')
    expect(text).toContain('specialized algorithm')
    expect(text).toContain('@see')
  })

  it('non-maturity tags do not affect routing', async () => {
    project.files = {
      src: {
        'augment.ts': `
declare module "./registry" {
  /**
   * @deprecated Use newFunction instead
   * @see newFunction
   * @public
   */
  function oldFunction(): void;
}
`,
      },
    }
    await project.write()

    const result = await extractModuleAugmentations({
      projectFolder: project.baseDir,
    })

    expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe(
      'public',
    )
    expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(false)
  })
})
