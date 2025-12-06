import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Project } from "fixturify-project";
import { extractModuleAugmentations } from "@";

describe("declaration kind coverage", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-pkg");
  });

  afterEach(async () => {
    await project.dispose();
  });

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

