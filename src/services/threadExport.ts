import type { Thread } from "../types/thread";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function formatThreadMarkdown(thread: Thread): string {
  const lines: string[] = [
    `# ${thread.title}`,
    "",
    `- Thread ID: ${thread.id}`,
    `- Created: ${formatTimestamp(thread.createdAt)}`,
    `- Updated: ${formatTimestamp(thread.updatedAt)}`,
  ];

  if (thread.scopeSnapshot) {
    lines.push(`- Scope: ${thread.scopeSnapshot.type}`);
    lines.push(`- Scope Label: ${thread.scopeSnapshot.label}`);
    lines.push(`- Scope ID: ${thread.scopeSnapshot.id}`);
  }

  lines.push("", "---", "");

  for (const message of thread.messages) {
    const roleLabel =
      message.role === "user"
        ? "User"
        : message.role === "assistant"
          ? "Assistant"
          : "System";
    lines.push(`## ${roleLabel}`);
    lines.push(`- Time: ${formatTimestamp(message.timestamp)}`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
  }

  return lines.join("\n");
}

export async function exportThreadAsMarkdown(
  thread: Thread,
  outputPath: string,
): Promise<string> {
  const markdown = formatThreadMarkdown(thread);
  const target =
    typeof Zotero.File.pathToFile === "function"
      ? Zotero.File.pathToFile(outputPath)
      : outputPath;
  const fileApi = Zotero.File as typeof Zotero.File & {
    putContentsAsync?: (
      path: string | nsIFile,
      data: string,
      charset?: string,
    ) => Promise<void>;
  };

  if (typeof fileApi.putContentsAsync === "function") {
    await fileApi.putContentsAsync(
      target as unknown as nsIFile,
      markdown,
      "utf-8",
    );
  } else {
    Zotero.File.putContents(target as unknown as nsIFile, markdown);
  }

  return outputPath;
}
