/** Map UI IDE labels (and aliases) to CLI binaries used by open_folder_in_ide. */
const IDE_BIN_MAP: Record<string, string> = {
  "vs code": "code",
  vscode: "code",
  code: "code",
  cursor: "cursor",
  windsurf: "windsurf",
  "system default": "code",
  default: "code",
};

export function resolveIdeBin(ide: string | null | undefined): string {
  const raw = (ide || "").trim();
  if (!raw) return "code";
  const mapped = IDE_BIN_MAP[raw.toLowerCase()];
  if (mapped) return mapped;
  // Already a binary name (no spaces) — pass through
  if (!/\s/.test(raw)) return raw;
  return "code";
}

export function ideDisplayLabel(ide: string | null | undefined): string {
  const raw = (ide || "").trim();
  if (!raw) return "VS Code";
  const bin = resolveIdeBin(raw);
  if (bin === "cursor") return "Cursor";
  if (bin === "windsurf") return "Windsurf";
  if (/system default/i.test(raw)) return "System Default";
  if (bin === "code") return "VS Code";
  return raw;
}
