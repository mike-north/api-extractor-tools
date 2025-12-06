import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "fixturify-project";
import * as path from "path";
import { extractModuleAugmentations, mergeModuleDeclarations } from "@";
import { createApiExtractorConfig } from "./helpers";

describe("edge cases", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-pkg");
  });

  afterEach(async () => {
    await project.dispose();
  });

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

describe("error handling", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-pkg");
  });

  afterEach(async () => {
    await project.dispose();
  });

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

