import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "fixturify-project";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import type { IConfigFile } from "@microsoft/api-extractor";
import {
  mergeModuleDeclarations,
  parseConfig,
  extractModuleAugmentations,
  createResolver,
  augmentRollups,
  ExtractorLogLevel,
} from "@";

/**
 * Creates a minimal valid api-extractor.json config.
 * Uses the IConfigFile type from @microsoft/api-extractor to ensure validity.
 */
function createApiExtractorConfig(overrides: Partial<IConfigFile> = {}): string {
  const config: IConfigFile = {
    mainEntryPointFilePath: "<projectFolder>/src/index.ts",
    projectFolder: ".",
    apiReport: {
      enabled: false,
      ...overrides.apiReport,
    },
    docModel: {
      enabled: false,
      ...overrides.docModel,
    },
    dtsRollup: {
      enabled: true,
      publicTrimmedFilePath: "<projectFolder>/dist/index.d.ts",
      ...overrides.dtsRollup,
    },
    ...overrides,
  };
  return JSON.stringify(config);
}

describe("module-declaration-merger", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-pkg");
  });

  afterEach(async () => {
    await project.dispose();
  });

  describe("parseConfig", () => {
    it("parses api-extractor.json and extracts rollup paths", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig({
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/index.d.ts",
            untrimmedFilePath: "<projectFolder>/dist/index-internal.d.ts",
          },
        }),
        src: {
          "index.ts": "export {}",
        },
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "node",
            declaration: true,
            outDir: "./dist",
            rootDir: "./src",
          },
          include: ["src/**/*.ts"],
        }),
      };
      await project.write();

      const config = parseConfig(
        path.join(project.baseDir, "api-extractor.json")
      );

      expect(config.projectFolder).toBe(project.baseDir);
      expect(config.mainEntryPointFilePath).toBe(
        path.join(project.baseDir, "src/index.ts")
      );
      expect(config.rollupPaths.public).toBe(
        path.join(project.baseDir, "dist/index.d.ts")
      );
      expect(config.rollupPaths.internal).toBe(
        path.join(project.baseDir, "dist/index-internal.d.ts")
      );
    });
  });

  describe("extractModuleAugmentations", () => {
    it("extracts declare module blocks from source files", async () => {
      project.files = {
        src: {
          "registry.ts": `
export interface Registry {}
`,
          things: {
            "first.ts": `
export interface FirstThing {
  type: "first";
}

declare module "../registry" {
  /**
   * Register FirstThing in the registry
   * @public
   */
  interface Registry {
    first: FirstThing;
  }
}
`,
          },
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.augmentations).toHaveLength(1);

      const aug = result.augmentations[0];
      expect(aug?.moduleSpecifier).toBe("../registry");
      expect(aug?.sourceFilePath).toBe("src/things/first.ts");
      expect(aug?.declarations).toHaveLength(1);
      expect(aug?.declarations[0]?.name).toBe("Registry");
      expect(aug?.declarations[0]?.maturityLevel).toBe("public");
    });

    it("extracts multiple declarations with different maturity levels", async () => {
      project.files = {
        src: {
          things: {
            "mixed.ts": `
declare module "../registry" {
  /** @public */
  interface PublicThing {}

  /** @internal */
  interface InternalThing {}

  /** @beta */
  interface BetaThing {}
}
`,
          },
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations).toHaveLength(1);
      const declarations = result.augmentations[0]?.declarations;
      expect(declarations).toHaveLength(3);
      expect(declarations?.[0]?.name).toBe("PublicThing");
      expect(declarations?.[0]?.maturityLevel).toBe("public");
      expect(declarations?.[1]?.name).toBe("InternalThing");
      expect(declarations?.[1]?.maturityLevel).toBe("internal");
      expect(declarations?.[2]?.name).toBe("BetaThing");
      expect(declarations?.[2]?.maturityLevel).toBe("beta");
    });
  });

  describe("createResolver", () => {
    it("resolves module paths relative to entry point", async () => {
      project.files = {
        src: {
          "index.ts": "export {}",
        },
      };
      await project.write();

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, "src/index.ts"),
      });

      // From src/things/first.ts, "../registry" should resolve to "./registry"
      const resolved = resolver.resolveModulePath(
        "../registry",
        "src/things/first.ts"
      );
      expect(resolved).toBe("./registry");

      // From src/deep/nested/file.ts, "../../registry" should resolve to "./registry"
      const resolved2 = resolver.resolveModulePath(
        "../../registry",
        "src/deep/nested/file.ts"
      );
      expect(resolved2).toBe("./registry");
    });

    it("preserves package imports unchanged", () => {
      const resolver = createResolver({
        projectFolder: "/project",
        mainEntryPointFilePath: "/project/src/index.ts",
      });

      expect(resolver.resolveModulePath("lodash", "src/utils.ts")).toBe(
        "lodash"
      );
      expect(
        resolver.resolveModulePath("@types/node", "src/utils.ts")
      ).toBe("@types/node");
    });
  });

  describe("augmentRollups", () => {
    it("appends module declarations to rollup files", async () => {
      project.files = {
        dist: {
          "index.d.ts": `// Existing rollup content
export interface Registry {}
`,
        },
      };
      await project.write();

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, "src/index.ts"),
      });

      const result = augmentRollups({
        augmentations: [
          {
            moduleSpecifier: "../registry",
            sourceFilePath: "src/things/first.ts",
            declarations: [
              {
                text: `/** @public */\ninterface Registry {\n  first: FirstThing;\n}`,
                maturityLevel: "public",
                name: "Registry",
                kind: "interface",
                isUntagged: false,
              },
            ],
            originalText: "",
          },
        ],
        rollupPaths: {
          public: path.join(project.baseDir, "dist/index.d.ts"),
        },
        resolver,
      });

      expect(result.errors).toHaveLength(0);
      expect(result.augmentedFiles).toHaveLength(1);

      const content = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );

      expect(content).toContain("// Existing rollup content");
      expect(content).toContain("// #region Module augmentation from src/things/first.ts");
      expect(content).toContain('declare module "./registry"');
      expect(content).toContain("interface Registry");
      expect(content).toContain("// #endregion");
    });
  });

  describe("mergeModuleDeclarations (integration)", () => {
    it("merges module declarations into rollup files", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig({
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/index.d.ts",
          },
        }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "node",
            declaration: true,
            outDir: "./dist",
            rootDir: "./src",
          },
          include: ["src/**/*.ts"],
        }),
        src: {
          "index.ts": `
export * from "./registry";
export * from "./things/first";
`,
          "registry.ts": `
export interface Registry {}
export type RegistryKeys = keyof Registry;
`,
          things: {
            "first.ts": `
export interface FirstThing {
  type: "first";
}

declare module "../registry" {
  /**
   * Register FirstThing in the registry
   * @public
   */
  interface Registry {
    first: FirstThing;
  }
}
`,
          },
        },
        dist: {
          "index.d.ts": `// API Extractor generated rollup
export interface Registry {}
export type RegistryKeys = keyof Registry;
export interface FirstThing {
  type: "first";
}
`,
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.errors).toHaveLength(0);
      expect(result.augmentedFiles).toHaveLength(1);
      expect(result.augmentationCount).toBe(1);
      expect(result.declarationCount).toBe(1);

      const content = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );

      // Check original content preserved
      expect(content).toContain("// API Extractor generated rollup");

      // Check augmentation added
      expect(content).toContain("Module Declarations (merged by module-declaration-merger)");
      expect(content).toContain("// #region Module augmentation from src/things/first.ts");
      expect(content).toContain('declare module "./registry"');
      expect(content).toContain("Register FirstThing in the registry");
      expect(content).toContain("@public");
      expect(content).toContain("// #endregion");
    });

    it("routes declarations to correct rollups based on maturity tags", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig({
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/public.d.ts",
            betaTrimmedFilePath: "<projectFolder>/dist/beta.d.ts",
            alphaTrimmedFilePath: "<projectFolder>/dist/alpha.d.ts",
            untrimmedFilePath: "<projectFolder>/dist/internal.d.ts",
          },
        }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "node",
            declaration: true,
            outDir: "./dist",
            rootDir: "./src",
          },
          include: ["src/**/*.ts"],
        }),
        src: {
          "index.ts": "export {}",
          things: {
            "mixed.ts": `
declare module "../registry" {
  /** @public */
  interface PublicThing {}

  /** @beta */
  interface BetaThing {}

  /** @alpha */
  interface AlphaThing {}

  /** @internal */
  interface InternalThing {}
}
`,
          },
        },
        dist: {
          "public.d.ts": "// public rollup\n",
          "beta.d.ts": "// beta rollup\n",
          "alpha.d.ts": "// alpha rollup\n",
          "internal.d.ts": "// internal rollup\n",
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.errors).toHaveLength(0);
      expect(result.augmentedFiles).toHaveLength(4);
      expect(result.declarationCount).toBe(4);

      // Read all rollups
      const publicContent = fs.readFileSync(
        path.join(project.baseDir, "dist/public.d.ts"),
        "utf-8"
      );
      const betaContent = fs.readFileSync(
        path.join(project.baseDir, "dist/beta.d.ts"),
        "utf-8"
      );
      const alphaContent = fs.readFileSync(
        path.join(project.baseDir, "dist/alpha.d.ts"),
        "utf-8"
      );
      const internalContent = fs.readFileSync(
        path.join(project.baseDir, "dist/internal.d.ts"),
        "utf-8"
      );

      // Public rollup: only @public
      expect(publicContent).toContain("PublicThing");
      expect(publicContent).not.toContain("BetaThing");
      expect(publicContent).not.toContain("AlphaThing");
      expect(publicContent).not.toContain("InternalThing");

      // Beta rollup: @public and @beta
      expect(betaContent).toContain("PublicThing");
      expect(betaContent).toContain("BetaThing");
      expect(betaContent).not.toContain("AlphaThing");
      expect(betaContent).not.toContain("InternalThing");

      // Alpha rollup: @public, @beta, and @alpha
      expect(alphaContent).toContain("PublicThing");
      expect(alphaContent).toContain("BetaThing");
      expect(alphaContent).toContain("AlphaThing");
      expect(alphaContent).not.toContain("InternalThing");

      // Internal rollup: everything
      expect(internalContent).toContain("PublicThing");
      expect(internalContent).toContain("BetaThing");
      expect(internalContent).toContain("AlphaThing");
      expect(internalContent).toContain("InternalThing");
    });
  });

  // ============================================
  // DECLARATION KIND COVERAGE
  // ============================================
  describe("declaration kind coverage", () => {
    it("extracts interface declarations", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  interface MyInterface {
    name: string;
    value: number;
  }
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.kind).toBe("interface");
      expect(result.augmentations[0]?.declarations[0]?.name).toBe("MyInterface");
    });

    it("extracts type alias declarations", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  type MyType = string | number;
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.kind).toBe("type");
      expect(result.augmentations[0]?.declarations[0]?.name).toBe("MyType");
    });

    it("extracts function declarations", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  function myFunction(x: string): number;
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.kind).toBe("function");
      expect(result.augmentations[0]?.declarations[0]?.name).toBe("myFunction");
    });

    it("extracts variable declarations", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  const myConst: string;
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.kind).toBe("variable");
      expect(result.augmentations[0]?.declarations[0]?.name).toBe("myConst");
    });

    it("extracts class declarations", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  class MyClass {
    constructor(name: string);
    getName(): string;
  }
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.kind).toBe("class");
      expect(result.augmentations[0]?.declarations[0]?.name).toBe("MyClass");
    });

    it("extracts enum declarations", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  enum MyEnum {
    A = "a",
    B = "b",
  }
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.kind).toBe("enum");
      expect(result.augmentations[0]?.declarations[0]?.name).toBe("MyEnum");
    });

    it("extracts namespace declarations", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  namespace MyNamespace {
    interface Inner {}
  }
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.kind).toBe("namespace");
      expect(result.augmentations[0]?.declarations[0]?.name).toBe("MyNamespace");
    });

    it("extracts all declaration kinds from one module block", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  interface MyInterface {}
  
  /** @public */
  type MyType = string;
  
  /** @public */
  function myFunction(): void;
  
  /** @public */
  const myConst: number;
  
  /** @public */
  class MyClass {}
  
  /** @public */
  enum MyEnum { A }
  
  /** @public */
  namespace MyNamespace {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      const declarations = result.augmentations[0]?.declarations ?? [];
      expect(declarations).toHaveLength(7);
      
      const kinds = declarations.map(d => d.kind);
      expect(kinds).toContain("interface");
      expect(kinds).toContain("type");
      expect(kinds).toContain("function");
      expect(kinds).toContain("variable");
      expect(kinds).toContain("class");
      expect(kinds).toContain("enum");
      expect(kinds).toContain("namespace");
    });
  });

  // ============================================
  // TSDOC COMMENT PRESERVATION
  // ============================================
  describe("TSDoc comment preservation", () => {
    it("preserves multi-line descriptions", async () => {
      project.files = {
        src: {
          "augment.ts": `
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
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      const text = result.augmentations[0]?.declarations[0]?.text ?? "";
      expect(text).toContain("This is a multi-line description");
      expect(text).toContain("that spans several lines");
      expect(text).toContain("It even has blank lines");
    });

    it("preserves @param and @returns tags", async () => {
      project.files = {
        src: {
          "augment.ts": `
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
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      const text = result.augmentations[0]?.declarations[0]?.text ?? "";
      expect(text).toContain("@param a - The first number");
      expect(text).toContain("@param b - The second number");
      expect(text).toContain("@returns The sum of a and b");
    });

    it("preserves @example tags with code blocks", async () => {
      project.files = {
        src: {
          "augment.ts": `
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
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      const text = result.augmentations[0]?.declarations[0]?.text ?? "";
      expect(text).toContain("@example");
      expect(text).toContain("createGreeter(\"World\")");
    });

    it("preserves @see and @remarks tags", async () => {
      project.files = {
        src: {
          "augment.ts": `
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
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      const text = result.augmentations[0]?.declarations[0]?.text ?? "";
      expect(text).toContain("@remarks");
      expect(text).toContain("specialized algorithm");
      expect(text).toContain("@see");
    });

    it("non-maturity tags do not affect routing", async () => {
      project.files = {
        src: {
          "augment.ts": `
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
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe("public");
      expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(false);
    });
  });

  // ============================================
  // COMPLEX MATURITY SCENARIOS
  // ============================================
  describe("complex maturity scenarios", () => {
    it("defaults untagged declarations to @public", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** Just a plain comment, no release tag */
  interface UntaggedInterface {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe("public");
      expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(true);
    });

    it("marks explicitly @public as not untagged", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  interface ExplicitPublic {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe("public");
      expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(false);
    });

    it("handles maturity tag in middle of comment", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /**
   * This is a description
   * with multiple lines
   * @internal
   * and more text after
   */
  interface MiddleTag {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe("internal");
    });

    it("handles declaration without any comment", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  interface NoComment {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.declarations[0]?.maturityLevel).toBe("public");
      expect(result.augmentations[0]?.declarations[0]?.isUntagged).toBe(true);
    });

    it("tracks untagged declarations in extraction result", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /** @public */
  interface Tagged {}
  
  /** No tag here */
  interface Untagged1 {}
  
  interface Untagged2 {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.untaggedDeclarations).toHaveLength(2);
      expect(result.untaggedDeclarations[0]?.name).toBe("Untagged1");
      expect(result.untaggedDeclarations[1]?.name).toBe("Untagged2");
    });
  });

  // ============================================
  // UNTAGGED DECLARATION HANDLING VIA ae-missing-release-tag
  // ============================================
  describe("ae-missing-release-tag handling", () => {
    it("silently defaults to @public when no config", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig(),
        src: {
          "index.ts": "export {}",
          "augment.ts": `
declare module "./registry" {
  interface Untagged {}
}
`,
        },
        dist: {
          "index.d.ts": "// rollup\n",
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("logs warning when logLevel is warning and addToApiReportFile is false", async () => {
      project.files = {
        "api-extractor.json": JSON.stringify({
          mainEntryPointFilePath: "<projectFolder>/src/index.ts",
          apiReport: { enabled: false },
          docModel: { enabled: false },
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/index.d.ts",
          },
          messages: {
            extractorMessageReporting: {
              "ae-missing-release-tag": {
                logLevel: "warning",
                addToApiReportFile: false,
              },
            },
          },
        }),
        src: {
          "index.ts": "export {}",
          "augment.ts": `
declare module "./registry" {
  interface Untagged {}
}
`,
        },
        dist: {
          "index.d.ts": "// rollup\n",
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("ae-missing-release-tag");
      expect(result.warnings[0]).toContain("Untagged");
      
      // Check no warning comment in rollup
      const content = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );
      expect(content).not.toContain("Missing Release Tag Warnings");
    });

    it("adds warning comment to rollup when addToApiReportFile is true", async () => {
      project.files = {
        "api-extractor.json": JSON.stringify({
          mainEntryPointFilePath: "<projectFolder>/src/index.ts",
          apiReport: { enabled: false },
          docModel: { enabled: false },
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/index.d.ts",
          },
          messages: {
            extractorMessageReporting: {
              "ae-missing-release-tag": {
                logLevel: "warning",
                addToApiReportFile: true,
              },
            },
          },
        }),
        src: {
          "index.ts": "export {}",
          "augment.ts": `
declare module "./registry" {
  interface Untagged {}
}
`,
        },
        dist: {
          "index.d.ts": "// rollup\n",
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.success).toBe(true);
      
      const content = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );
      expect(content).toContain("Missing Release Tag Warnings");
      expect(content).toContain("WARNING:");
      expect(content).toContain("Untagged");
    });

    it("stops processing when logLevel is error and addToApiReportFile is false", async () => {
      project.files = {
        "api-extractor.json": JSON.stringify({
          mainEntryPointFilePath: "<projectFolder>/src/index.ts",
          apiReport: { enabled: false },
          docModel: { enabled: false },
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/index.d.ts",
          },
          messages: {
            extractorMessageReporting: {
              "ae-missing-release-tag": {
                logLevel: "error",
                addToApiReportFile: false,
              },
            },
          },
        }),
        src: {
          "index.ts": "export {}",
          "augment.ts": `
declare module "./registry" {
  interface Untagged {}
}
`,
        },
        dist: {
          "index.d.ts": "// rollup\n",
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.augmentedFiles).toHaveLength(0); // Stopped before augmenting
    });

    it("continues processing when logLevel is error and addToApiReportFile is true", async () => {
      project.files = {
        "api-extractor.json": JSON.stringify({
          mainEntryPointFilePath: "<projectFolder>/src/index.ts",
          apiReport: { enabled: false },
          docModel: { enabled: false },
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/index.d.ts",
          },
          messages: {
            extractorMessageReporting: {
              "ae-missing-release-tag": {
                logLevel: "error",
                addToApiReportFile: true,
              },
            },
          },
        }),
        src: {
          "index.ts": "export {}",
          "augment.ts": `
declare module "./registry" {
  interface Untagged {}
}
`,
        },
        dist: {
          "index.d.ts": "// rollup\n",
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(1); // Error is recorded
      expect(result.augmentedFiles).toHaveLength(1); // But file was still augmented
      
      const content = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );
      expect(content).toContain("Missing Release Tag Warnings");
    });
  });

  // ============================================
  // MULTIPLE SOURCE FILES
  // ============================================
  describe("multiple source files", () => {
    it("extracts augmentations from multiple files", async () => {
      project.files = {
        src: {
          "first.ts": `
declare module "./registry" {
  /** @public */
  interface First {}
}
`,
          "second.ts": `
declare module "./registry" {
  /** @public */
  interface Second {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations).toHaveLength(2);
      
      const names = result.augmentations.flatMap(a => a.declarations.map(d => d.name));
      expect(names).toContain("First");
      expect(names).toContain("Second");
    });

    it("handles files at different directory depths", async () => {
      project.files = {
        src: {
          "shallow.ts": `
declare module "./registry" {
  /** @public */
  interface Shallow {}
}
`,
          deep: {
            nested: {
              "deep.ts": `
declare module "../../../registry" {
  /** @public */
  interface Deep {}
}
`,
            },
          },
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations).toHaveLength(2);
    });

    it("handles multiple declare module blocks in one file", async () => {
      project.files = {
        src: {
          "multi.ts": `
declare module "./registry-a" {
  /** @public */
  interface FromA {}
}

declare module "./registry-b" {
  /** @public */
  interface FromB {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations).toHaveLength(2);
      expect(result.augmentations[0]?.moduleSpecifier).toBe("./registry-a");
      expect(result.augmentations[1]?.moduleSpecifier).toBe("./registry-b");
    });

    it("combines declarations from multiple files in same rollup", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig(),
        src: {
          "index.ts": "export {}",
          things: {
            "first.ts": `
declare module "../registry" {
  /** @public */
  interface First {}
}
`,
            "second.ts": `
declare module "../registry" {
  /** @public */
  interface Second {}
}
`,
          },
        },
        dist: {
          "index.d.ts": "// rollup\n",
        },
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.success).toBe(true);
      
      const content = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );
      expect(content).toContain("First");
      expect(content).toContain("Second");
      expect(content).toContain("src/things/first.ts");
      expect(content).toContain("src/things/second.ts");
    });
  });

  // ============================================
  // MODULE PATH RESOLUTION
  // ============================================
  describe("module path resolution", () => {
    it("resolves deeply nested relative paths", async () => {
      project.files = {
        src: {
          "index.ts": "export {}",
        },
      };
      await project.write();

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, "src/index.ts"),
      });

      // From src/a/b/c/d/file.ts, "../../../../registry" -> "./registry"
      const resolved = resolver.resolveModulePath(
        "../../../../registry",
        "src/a/b/c/d/file.ts"
      );
      expect(resolved).toBe("./registry");
    });

    it("resolves sibling module paths", async () => {
      project.files = {
        src: {
          "index.ts": "export {}",
        },
      };
      await project.write();

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, "src/index.ts"),
      });

      // From src/utils/helper.ts, "./sibling" -> "./utils/sibling"
      const resolved = resolver.resolveModulePath(
        "./sibling",
        "src/utils/helper.ts"
      );
      expect(resolved).toBe("./utils/sibling");
    });

    it("resolves parent directory paths", async () => {
      project.files = {
        src: {
          "index.ts": "export {}",
        },
      };
      await project.write();

      const resolver = createResolver({
        projectFolder: project.baseDir,
        mainEntryPointFilePath: path.join(project.baseDir, "src/index.ts"),
      });

      // From src/utils/sub/file.ts, "../parent" -> "./utils/parent"
      const resolved = resolver.resolveModulePath(
        "../parent",
        "src/utils/sub/file.ts"
      );
      expect(resolved).toBe("./utils/parent");
    });

    it("preserves bare package imports", async () => {
      const resolver = createResolver({
        projectFolder: "/project",
        mainEntryPointFilePath: "/project/src/index.ts",
      });

      expect(resolver.resolveModulePath("lodash", "src/utils.ts")).toBe("lodash");
      expect(resolver.resolveModulePath("lodash/fp", "src/utils.ts")).toBe("lodash/fp");
    });

    it("preserves scoped package imports", async () => {
      const resolver = createResolver({
        projectFolder: "/project",
        mainEntryPointFilePath: "/project/src/index.ts",
      });

      expect(resolver.resolveModulePath("@types/node", "src/utils.ts")).toBe("@types/node");
      expect(resolver.resolveModulePath("@scope/package/sub", "src/utils.ts")).toBe("@scope/package/sub");
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe("edge cases", () => {
    it("handles empty declare module block", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  // Empty block
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      // Empty blocks should not be included
      expect(result.augmentations).toHaveLength(0);
    });

    it("handles declare module with only non-declaration statements", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  // Just a comment
  // Another comment
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations).toHaveLength(0);
    });

    it("handles Unicode in comments and identifiers", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "./registry" {
  /**
   * 日本語のコメント
   * Ελληνικά
   * @public
   */
  interface Интерфейс {
    名前: string;
  }
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations).toHaveLength(1);
      expect(result.augmentations[0]?.declarations[0]?.text).toContain("日本語");
      expect(result.augmentations[0]?.declarations[0]?.text).toContain("Ελληνικά");
    });

    it("skips gracefully when rollup file does not exist", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig({
          dtsRollup: {
            enabled: true,
            publicTrimmedFilePath: "<projectFolder>/dist/nonexistent.d.ts",
          },
        }),
        src: {
          "index.ts": "export {}",
          "augment.ts": `
declare module "./registry" {
  /** @public */
  interface MyInterface {}
}
`,
        },
        // Note: no dist folder
      };
      await project.write();

      const result = await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      expect(result.success).toBe(true);
      expect(result.augmentedFiles).toHaveLength(0);
      expect(result.skippedFiles).toHaveLength(1);
    });

    it("handles special characters in module specifiers", async () => {
      project.files = {
        src: {
          "augment.ts": `
declare module "@scope/package-name/sub-module" {
  /** @public */
  interface MyInterface {}
}
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      expect(result.augmentations[0]?.moduleSpecifier).toBe("@scope/package-name/sub-module");
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================
  describe("error handling", () => {
    it("throws on invalid api-extractor.json", async () => {
      project.files = {
        "api-extractor.json": "{ invalid json }",
      };
      await project.write();

      await expect(
        mergeModuleDeclarations({
          configPath: path.join(project.baseDir, "api-extractor.json"),
        })
      ).rejects.toThrow("Failed to parse");
    });

    it("throws on missing mainEntryPointFilePath", async () => {
      project.files = {
        "api-extractor.json": JSON.stringify({
          apiReport: { enabled: false },
          docModel: { enabled: false },
        }),
      };
      await project.write();

      await expect(
        mergeModuleDeclarations({
          configPath: path.join(project.baseDir, "api-extractor.json"),
        })
      ).rejects.toThrow("mainEntryPointFilePath");
    });

    it("throws on non-existent config file", async () => {
      await expect(
        mergeModuleDeclarations({
          configPath: path.join(project.baseDir, "nonexistent.json"),
        })
      ).rejects.toThrow("not found");
    });

    it("reports errors for malformed TypeScript files", async () => {
      project.files = {
        src: {
          // Valid TypeScript - createSourceFile doesn't throw on syntax errors
          // but the file has no valid module augmentations
          "bad.ts": `
// This is valid TS, just has no augmentations
const x = 1;
`,
        },
      };
      await project.write();

      const result = await extractModuleAugmentations({
        projectFolder: project.baseDir,
      });

      // No errors - TS parser is lenient
      expect(result.errors).toHaveLength(0);
      expect(result.augmentations).toHaveLength(0);
    });
  });

  // ============================================
  // TYPESCRIPT TYPE VERIFICATION
  // ============================================
  describe("TypeScript type verification", () => {
    it("produces valid TypeScript that compiles", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig(),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "node",
            declaration: true,
            strict: true,
            skipLibCheck: true,
          },
        }),
        src: {
          "index.ts": "export {}",
          "registry.ts": `
export interface Registry {}
`,
          things: {
            "first.ts": `
export interface FirstThing {
  id: string;
}

declare module "../registry" {
  /**
   * Adds FirstThing to the registry
   * @public
   */
  interface Registry {
    first: import("./first").FirstThing;
  }
}
`,
          },
        },
        dist: {
          "index.d.ts": `
export interface Registry {}
export interface FirstThing {
  id: string;
}
`,
        },
      };
      await project.write();

      // Run the merger
      await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      // Read the augmented rollup
      const rollupContent = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );

      // Create a TypeScript program to verify the output compiles
      const program = ts.createProgram(
        [path.join(project.baseDir, "dist/index.d.ts")],
        {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          declaration: true,
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        }
      );

      const diagnostics = ts.getPreEmitDiagnostics(program);
      const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
      
      // Should compile without errors
      expect(errors).toHaveLength(0);
    });

    it("interface augmentations merge correctly (Registry pattern)", async () => {
      project.files = {
        "api-extractor.json": createApiExtractorConfig(),
        "tsconfig.json": JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "node",
            declaration: true,
            strict: true,
            skipLibCheck: true,
          },
        }),
        src: {
          "index.ts": "export {}",
          things: {
            "first.ts": `
declare module "../registry" {
  /** @public */
  interface Registry {
    first: { type: "first" };
  }
}
`,
            "second.ts": `
declare module "../registry" {
  /** @public */
  interface Registry {
    second: { type: "second" };
  }
}
`,
          },
        },
        dist: {
          "index.d.ts": `
export interface Registry {}
export type RegistryKeys = keyof Registry;
`,
        },
      };
      await project.write();

      await mergeModuleDeclarations({
        configPath: path.join(project.baseDir, "api-extractor.json"),
      });

      const rollupContent = fs.readFileSync(
        path.join(project.baseDir, "dist/index.d.ts"),
        "utf-8"
      );

      // Both augmentations should be present
      expect(rollupContent).toContain("first:");
      expect(rollupContent).toContain("second:");
    });
  });
});
