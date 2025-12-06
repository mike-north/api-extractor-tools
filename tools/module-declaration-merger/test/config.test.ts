import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "fixturify-project";
import * as path from "path";
import { parseConfig } from "@";
import { createApiExtractorConfig } from "./helpers";

describe("parseConfig", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-pkg");
  });

  afterEach(async () => {
    await project.dispose();
  });

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

