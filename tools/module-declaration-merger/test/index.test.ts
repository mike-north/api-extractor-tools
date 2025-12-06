import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "fixturify-project";
import * as fs from "fs";
import * as path from "path";
import type { IConfigFile } from "@microsoft/api-extractor";
import {
  mergeModuleDeclarations,
  parseConfig,
  extractModuleAugmentations,
  createResolver,
  augmentRollups,
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
});
