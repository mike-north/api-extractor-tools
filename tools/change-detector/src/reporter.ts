import type { Change, ComparisonReport, ReleaseType } from "./types";

/**
 * Formats the release type as a human-readable label.
 */
function formatReleaseType(releaseType: ReleaseType): string {
  switch (releaseType) {
    case "major":
      return "MAJOR";
    case "minor":
      return "MINOR";
    case "patch":
      return "PATCH";
    case "none":
      return "NONE";
  }
}

/**
 * Formats a single change as plain text.
 */
function formatChangeAsText(change: Change, indent: string = "  "): string {
  const lines: string[] = [];
  const releaseLabel = `[${formatReleaseType(change.releaseType)}]`;

  lines.push(`${indent}${releaseLabel} ${change.symbolKind}: ${change.symbolName}`);
  lines.push(`${indent}  ${change.explanation}`);

  if (change.before && change.after && change.before !== change.after) {
    lines.push(`${indent}  Before: ${change.before}`);
    lines.push(`${indent}  After:  ${change.after}`);
  } else if (change.before && !change.after) {
    lines.push(`${indent}  Was: ${change.before}`);
  } else if (change.after && !change.before) {
    lines.push(`${indent}  Now: ${change.after}`);
  }

  return lines.join("\n");
}

/**
 * Formats the comparison report as plain text.
 */
export function formatReportAsText(report: ComparisonReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`Release Type: ${formatReleaseType(report.releaseType)}`);
  lines.push("");

  // Breaking changes
  lines.push(`Breaking Changes (${report.changes.breaking.length}):`);
  if (report.changes.breaking.length === 0) {
    lines.push("  None");
  } else {
    for (const change of report.changes.breaking) {
      lines.push(formatChangeAsText(change));
    }
  }
  lines.push("");

  // Non-breaking changes
  lines.push(`Non-Breaking Changes (${report.changes.nonBreaking.length}):`);
  if (report.changes.nonBreaking.length === 0) {
    lines.push("  None");
  } else {
    for (const change of report.changes.nonBreaking) {
      lines.push(formatChangeAsText(change));
    }
  }
  lines.push("");

  // Summary
  const { stats } = report;
  lines.push(
    `Summary: ${stats.added} addition(s), ${stats.removed} removal(s), ` +
      `${stats.modified} modification(s), ${stats.unchanged} unchanged`
  );

  return lines.join("\n");
}

/**
 * Formats a single change as markdown.
 */
function formatChangeAsMarkdown(change: Change): string {
  const lines: string[] = [];
  const releaseLabel = `**${formatReleaseType(change.releaseType)}**`;

  lines.push(`- ${releaseLabel} \`${change.symbolName}\` (${change.symbolKind})`);
  lines.push(`  - ${change.explanation}`);

  if (change.before && change.after && change.before !== change.after) {
    lines.push(`  - Before: \`${change.before}\``);
    lines.push(`  - After: \`${change.after}\``);
  } else if (change.before && !change.after) {
    lines.push(`  - Was: \`${change.before}\``);
  } else if (change.after && !change.before) {
    lines.push(`  - Signature: \`${change.after}\``);
  }

  return lines.join("\n");
}

/**
 * Formats the comparison report as markdown.
 */
export function formatReportAsMarkdown(report: ComparisonReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`## API Change Report`);
  lines.push("");
  lines.push(`**Release Type:** ${formatReleaseType(report.releaseType)}`);
  lines.push("");

  // Breaking changes
  lines.push(`### Breaking Changes (${report.changes.breaking.length})`);
  lines.push("");
  if (report.changes.breaking.length === 0) {
    lines.push("_None_");
  } else {
    for (const change of report.changes.breaking) {
      lines.push(formatChangeAsMarkdown(change));
    }
  }
  lines.push("");

  // Non-breaking changes
  lines.push(`### Non-Breaking Changes (${report.changes.nonBreaking.length})`);
  lines.push("");
  if (report.changes.nonBreaking.length === 0) {
    lines.push("_None_");
  } else {
    for (const change of report.changes.nonBreaking) {
      lines.push(formatChangeAsMarkdown(change));
    }
  }
  lines.push("");

  // Summary table
  lines.push(`### Summary`);
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push(`| Symbols (old) | ${report.stats.totalSymbolsOld} |`);
  lines.push(`| Symbols (new) | ${report.stats.totalSymbolsNew} |`);
  lines.push(`| Added | ${report.stats.added} |`);
  lines.push(`| Removed | ${report.stats.removed} |`);
  lines.push(`| Modified | ${report.stats.modified} |`);
  lines.push(`| Unchanged | ${report.stats.unchanged} |`);

  return lines.join("\n");
}

/**
 * Converts the report to a plain JSON-serializable object.
 */
export function reportToJSON(
  report: ComparisonReport
): Record<string, unknown> {
  return {
    releaseType: report.releaseType,
    changes: {
      breaking: report.changes.breaking,
      nonBreaking: report.changes.nonBreaking,
      unchanged: report.changes.unchanged,
    },
    stats: report.stats,
    oldFile: report.oldFile,
    newFile: report.newFile,
  };
}

