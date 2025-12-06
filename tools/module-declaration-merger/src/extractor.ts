import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { TSDocParser, type ParserContext } from "@microsoft/tsdoc";
import { glob } from "fast-glob";
import type { MaturityLevel } from "./config";

/**
 * The kinds of declarations we extract from module augmentation blocks
 */
export type DeclarationKind =
  | "interface"
  | "type"
  | "function"
  | "variable"
  | "class"
  | "enum"
  | "namespace";

/**
 * A single declaration extracted from within a `declare module` block
 */
export interface ExtractedDeclaration {
  /** The full text of the declaration including its TSDoc comment */
  text: string;
  /** The maturity level determined from TSDoc tags (@ public, @ beta, @ alpha, @ internal) */
  maturityLevel: MaturityLevel;
  /** The name of the declaration (e.g., interface name, type name) */
  name: string;
  /** The kind of declaration */
  kind: DeclarationKind;
  /** True if no release tag was found (defaulted to public) */
  isUntagged: boolean;
}

/**
 * A module augmentation block extracted from a source file
 */
export interface ExtractedModuleAugmentation {
  /** The module specifier from `declare module "..."` */
  moduleSpecifier: string;
  /** The source file path this augmentation came from */
  sourceFilePath: string;
  /** Individual declarations within this module block */
  declarations: ExtractedDeclaration[];
  /** The original full text of the declare module block (for reference) */
  originalText: string;
}

/**
 * Info about an untagged declaration (missing release tag)
 */
export interface UntaggedDeclarationInfo {
  /** The declaration name */
  name: string;
  /** The source file path */
  sourceFilePath: string;
  /** The module specifier it was found in */
  moduleSpecifier: string;
  /** The kind of declaration */
  kind: DeclarationKind;
}

/**
 * Result of extracting all module augmentations from a project
 */
export interface ExtractionResult {
  /** All extracted module augmentations grouped by source file */
  augmentations: ExtractedModuleAugmentation[];
  /** Any errors encountered during extraction */
  errors: string[];
  /** Declarations that had no release tag (defaulted to @public) */
  untaggedDeclarations: UntaggedDeclarationInfo[];
}

// Create a TSDoc parser - the standard tags (@public, @beta, @alpha, @internal)
// are built into TSDocConfiguration by default
const tsdocParser = new TSDocParser();

/**
 * Result of parsing a TSDoc comment for maturity level
 */
interface MaturityParseResult {
  /** The maturity level (defaults to "public" if no tag found) */
  maturityLevel: MaturityLevel;
  /** True if no release tag was found (defaulted to public) */
  isUntagged: boolean;
}

/**
 * Determines the maturity level from a TSDoc comment using proper TSDoc parsing.
 * This correctly handles TSDoc syntax and won't match false positives like email addresses.
 */
function getMaturityLevelFromComment(
  commentText: string | undefined
): MaturityParseResult {
  if (!commentText) {
    return { maturityLevel: "public", isUntagged: true }; // Default to public if no comment
  }

  // Parse the comment with TSDoc
  const parserContext: ParserContext = tsdocParser.parseString(commentText);

  // Check for modifier tags in order of specificity
  // (more restrictive tags take precedence)
  const modifierTags = parserContext.docComment.modifierTagSet;

  if (modifierTags.hasTagName("@internal")) {
    return { maturityLevel: "internal", isUntagged: false };
  }
  if (modifierTags.hasTagName("@alpha")) {
    return { maturityLevel: "alpha", isUntagged: false };
  }
  if (modifierTags.hasTagName("@beta")) {
    return { maturityLevel: "beta", isUntagged: false };
  }
  if (modifierTags.hasTagName("@public")) {
    return { maturityLevel: "public", isUntagged: false };
  }

  // No release tag found - default to public but mark as untagged
  return { maturityLevel: "public", isUntagged: true };
}

/**
 * Gets the leading comment text for a node
 */
function getLeadingCommentText(
  node: ts.Node,
  sourceFile: ts.SourceFile
): string | undefined {
  const fullText = sourceFile.getFullText();
  const commentRanges = ts.getLeadingCommentRanges(
    fullText,
    node.getFullStart()
  );

  if (!commentRanges || commentRanges.length === 0) {
    return undefined;
  }

  // Get all comments and join them
  return commentRanges
    .map((range) => fullText.slice(range.pos, range.end))
    .join("\n");
}

/**
 * Gets the full text of a node including its leading comments
 */
function getNodeTextWithComments(
  node: ts.Node,
  sourceFile: ts.SourceFile
): string {
  const fullText = sourceFile.getFullText();
  const start = node.getFullStart();
  const end = node.getEnd();
  return fullText.slice(start, end).trim();
}

/**
 * The TypeScript syntax kinds we support extracting from module blocks
 */
type SupportedDeclarationSyntaxKind =
  | ts.SyntaxKind.InterfaceDeclaration
  | ts.SyntaxKind.TypeAliasDeclaration
  | ts.SyntaxKind.FunctionDeclaration
  | ts.SyntaxKind.VariableStatement
  | ts.SyntaxKind.ClassDeclaration
  | ts.SyntaxKind.EnumDeclaration
  | ts.SyntaxKind.ModuleDeclaration;

/**
 * Maps TypeScript syntax kinds to our declaration kind type
 */
const SYNTAX_KIND_TO_DECLARATION_KIND: Record<
  SupportedDeclarationSyntaxKind,
  DeclarationKind
> = {
  [ts.SyntaxKind.InterfaceDeclaration]: "interface",
  [ts.SyntaxKind.TypeAliasDeclaration]: "type",
  [ts.SyntaxKind.FunctionDeclaration]: "function",
  [ts.SyntaxKind.VariableStatement]: "variable",
  [ts.SyntaxKind.ClassDeclaration]: "class",
  [ts.SyntaxKind.EnumDeclaration]: "enum",
  [ts.SyntaxKind.ModuleDeclaration]: "namespace",
};

/**
 * Checks if a node is a supported declaration type
 */
function isSupportedDeclaration(
  node: ts.Node
): node is ts.Node & { kind: SupportedDeclarationSyntaxKind } {
  return node.kind in SYNTAX_KIND_TO_DECLARATION_KIND;
}

/**
 * Gets the declaration kind for a supported node.
 * This is exhaustive over all supported declaration types.
 */
function getDeclarationKind(
  node: ts.Node & { kind: SupportedDeclarationSyntaxKind }
): DeclarationKind {
  return SYNTAX_KIND_TO_DECLARATION_KIND[node.kind];
}

/**
 * Gets the name of a declaration node
 */
function getDeclarationName(node: ts.Node): string {
  if (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  ) {
    return node.name?.getText() ?? "<anonymous>";
  }
  if (ts.isVariableStatement(node)) {
    const declarations = node.declarationList.declarations;
    return declarations.map((d) => d.name.getText()).join(", ");
  }
  return "<unknown>";
}

/**
 * Extracts declarations from within a ModuleBlock
 */
function extractDeclarationsFromModuleBlock(
  moduleBlock: ts.ModuleBlock,
  sourceFile: ts.SourceFile
): ExtractedDeclaration[] {
  const declarations: ExtractedDeclaration[] = [];

  for (const statement of moduleBlock.statements) {
    // Skip non-declaration statements
    if (!isSupportedDeclaration(statement)) {
      continue;
    }

    const commentText = getLeadingCommentText(statement, sourceFile);
    const { maturityLevel, isUntagged } = getMaturityLevelFromComment(commentText);
    const text = getNodeTextWithComments(statement, sourceFile);
    const name = getDeclarationName(statement);
    const kind = getDeclarationKind(statement);

    declarations.push({
      text,
      maturityLevel,
      name,
      kind,
      isUntagged,
    });
  }

  return declarations;
}

/**
 * Extracts all module augmentations from a single source file
 */
function extractFromSourceFile(
  sourceFile: ts.SourceFile,
  filePath: string
): ExtractedModuleAugmentation[] {
  const augmentations: ExtractedModuleAugmentation[] = [];

  function visit(node: ts.Node): void {
    // Look for `declare module "..."` statements
    if (
      ts.isModuleDeclaration(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) &&
      ts.isStringLiteral(node.name)
    ) {
      const moduleSpecifier = node.name.text;
      const originalText = getNodeTextWithComments(node, sourceFile);

      // Get the module body
      let declarations: ExtractedDeclaration[] = [];
      if (node.body && ts.isModuleBlock(node.body)) {
        declarations = extractDeclarationsFromModuleBlock(
          node.body,
          sourceFile
        );
      }

      if (declarations.length > 0) {
        augmentations.push({
          moduleSpecifier,
          sourceFilePath: filePath,
          declarations,
          originalText,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return augmentations;
}

/**
 * Options for extracting module augmentations
 */
export interface ExtractOptions {
  /** The project folder to search for source files */
  projectFolder: string;
  /** Glob patterns for source files to include (default: ['**\/*.ts', '**\/*.tsx']) */
  include?: string[];
  /** Glob patterns for files to exclude (default: ['**\/node_modules\/**', '**\/*.d.ts']) */
  exclude?: string[];
}

/**
 * Extracts all module augmentations from TypeScript source files in a project
 *
 * @param options - Extraction options
 * @returns Extraction result with all augmentations and any errors
 */
export async function extractModuleAugmentations(
  options: ExtractOptions
): Promise<ExtractionResult> {
  const {
    projectFolder,
    include = ["**/*.ts", "**/*.tsx"],
    exclude = ["**/node_modules/**", "**/*.d.ts", "**/dist/**"],
  } = options;

  const augmentations: ExtractedModuleAugmentation[] = [];
  const errors: string[] = [];
  const untaggedDeclarations: UntaggedDeclarationInfo[] = [];

  // Find all TypeScript files
  const files = await glob(include, {
    cwd: projectFolder,
    ignore: exclude,
    absolute: true,
  });

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true, // setParentNodes
        ts.ScriptKind.TS
      );

      const relativePath = path.relative(projectFolder, filePath);
      const fileAugmentations = extractFromSourceFile(sourceFile, relativePath);
      augmentations.push(...fileAugmentations);

      // Collect untagged declarations info
      for (const aug of fileAugmentations) {
        for (const decl of aug.declarations) {
          if (decl.isUntagged) {
            untaggedDeclarations.push({
              name: decl.name,
              sourceFilePath: aug.sourceFilePath,
              moduleSpecifier: aug.moduleSpecifier,
              kind: decl.kind,
            });
          }
        }
      }
    } catch (error) {
      errors.push(
        `Error processing ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return { augmentations, errors, untaggedDeclarations };
}
