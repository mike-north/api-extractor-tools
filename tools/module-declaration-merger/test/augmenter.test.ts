import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Project } from 'fixturify-project'
import * as fs from 'fs'
import * as path from 'path'
import { createResolver, augmentRollups } from '@'

describe('augmentRollups', () => {
  let project: Project

  beforeEach(() => {
    project = new Project('test-pkg')
  })

  afterEach(async () => {
    await project.dispose()
  })

  it('appends module declarations to rollup files', async () => {
    project.files = {
      dist: {
        'index.d.ts': `// Existing rollup content
export interface Registry {}
`,
      },
    }
    await project.write()

    const resolver = createResolver({
      projectFolder: project.baseDir,
      mainEntryPointFilePath: path.join(project.baseDir, 'src/index.ts'),
    })

    const result = augmentRollups({
      augmentations: [
        {
          moduleSpecifier: '../registry',
          sourceFilePath: 'src/things/first.ts',
          declarations: [
            {
              text: `/** @public */\ninterface Registry {\n  first: FirstThing;\n}`,
              maturityLevel: 'public',
              name: 'Registry',
              kind: 'interface',
              isUntagged: false,
            },
          ],
          originalText: '',
        },
      ],
      rollupPaths: {
        public: path.join(project.baseDir, 'dist/index.d.ts'),
      },
      resolver,
    })

    expect(result.errors).toHaveLength(0)
    expect(result.augmentedFiles).toHaveLength(1)

    const content = fs.readFileSync(
      path.join(project.baseDir, 'dist/index.d.ts'),
      'utf-8',
    )

    expect(content).toContain('// Existing rollup content')
    expect(content).toContain(
      '// #region Module augmentation from src/things/first.ts',
    )
    expect(content).toContain('declare module "./registry"')
    expect(content).toContain('interface Registry')
    expect(content).toContain('// #endregion')
  })
})



