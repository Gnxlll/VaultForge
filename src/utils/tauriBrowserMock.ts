/**
 * In-browser stand-in for Tauri commands so `npm run dev` can exercise UI flows
 * without the desktop runtime. Data persists in localStorage.
 */

const STORAGE_KEY = "vaultforge.browserMock.v1";

type ProjectRow = {
  id: string;
  name: string;
  path: string;
  ide: string;
  status: string;
  favorite: number;
  tags: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type FolderRow = {
  id: string;
  name: string;
  path: string;
  preferred_ide: string | null;
  description?: string | null;
  created_at?: string;
};

type VaultRow = {
  id: string;
  item_type: string;
  title: string;
  created_at: string;
  /** Mock-only: passcode + plaintext kept for browser unlock simulation */
  passcode: string;
  plaintext: string;
};

type SecureFileRow = {
  id: string;
  original_filename: string;
  file_size: number;
  hint: string;
  created_at: string;
  mime_type: string | null;
  encrypted_file_path: string;
  modified_at: string | null;
  passcode: string;
  /** base64 content for preview/export in browser mock */
  content_b64: string;
};

type Store = {
  projects: ProjectRow[];
  folders: FolderRow[];
  vaultItems: VaultRow[];
  secureFiles: SecureFileRow[];
};

function nowIso() {
  return new Date().toISOString();
}

function seedStore(): Store {
  const ts = nowIso();
  return {
    projects: [
      {
        id: "browser-demo-1",
        name: "Close",
        path: "C:\\Users\\Gab\\Desktop\\CloseIt\\close-it",
        ide: "System Default",
        status: "Active",
        favorite: 0,
        tags: "",
        notes: "",
        created_at: ts,
        updated_at: ts,
      },
    ],
    folders: [],
    vaultItems: [
      {
        id: "vault-demo-1",
        item_type: "note",
        title: "Demo Secure Note",
        created_at: ts,
        passcode: "demo1234",
        plaintext: "This is a browser-mock vault note.\nPasscode: demo1234",
      },
      {
        id: "vault-demo-2",
        item_type: "credential",
        title: "Demo Credential",
        created_at: ts,
        passcode: "demo1234",
        plaintext: "user: admin\npassword: s3cret!",
      },
    ],
    secureFiles: [
      {
        id: "file-demo-1",
        original_filename: "notes.txt",
        file_size: 42,
        hint: "demo hint",
        created_at: ts,
        mime_type: "text/plain",
        encrypted_file_path: "browser-mock://notes.txt.enc",
        modified_at: String(Math.floor(Date.now() / 1000)),
        passcode: "demo1234",
        content_b64: btoa("Hello from secure file mock.\nPasscode: demo1234"),
      },
      {
        id: "file-demo-2",
        original_filename: "binary-sample.bin",
        file_size: 16,
        hint: "demo hint",
        created_at: ts,
        mime_type: "application/octet-stream",
        encrypted_file_path: "browser-mock://binary-sample.bin.enc",
        modified_at: String(Math.floor(Date.now() / 1000)),
        passcode: "demo1234",
        content_b64: btoa("0123456789ABCDEF"),
      },
    ],
  };
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Partial<Store>;
    const seeded = seedStore();
    return {
      projects: parsed.projects ?? seeded.projects,
      folders: parsed.folders ?? seeded.folders,
      vaultItems: parsed.vaultItems ?? seeded.vaultItems,
      secureFiles: parsed.secureFiles ?? seeded.secureFiles,
    };
  } catch {
    return seedStore();
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function argRecord(args: unknown): Record<string, unknown> {
  return args && typeof args === "object"
    ? (args as Record<string, unknown>)
    : {};
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown): boolean {
  return Boolean(v);
}

function randomId() {
  return crypto?.randomUUID?.() ?? `mock-${Date.now()}`;
}

function publicVaultItems(items: VaultRow[]) {
  return items.map(({ id, item_type, title, created_at }) => ({
    id,
    item_type,
    title,
    created_at,
  }));
}

function publicSecureFiles(files: SecureFileRow[]) {
  return files.map(
    ({
      id,
      original_filename,
      file_size,
      hint,
      created_at,
      mime_type,
      encrypted_file_path,
      modified_at,
    }) => ({
      id,
      original_filename,
      file_size,
      hint,
      created_at,
      mime_type,
      encrypted_file_path,
      modified_at,
    }),
  );
}

export function isBrowserMockActive() {
  return true;
}

export async function mockInvoke<T>(
  command: string,
  args?: unknown,
): Promise<T> {
  const a = argRecord(args);
  const store = readStore();

  switch (command) {
    case "get_projects":
      return [...store.projects].sort((x, y) =>
        y.created_at.localeCompare(x.created_at),
      ) as T;

    case "save_project": {
      const id = str(a.id, randomId());
      const ts = nowIso();
      const existing = store.projects.find((p) => p.id === id);
      const row: ProjectRow = {
        id,
        name: str(a.name),
        path: str(a.path),
        ide: str(a.ide, "VS Code"),
        status: str(a.status, "Active"),
        favorite: bool(a.favorite) ? 1 : 0,
        tags: str(a.tags),
        notes: str(a.notes),
        created_at: existing?.created_at ?? ts,
        updated_at: ts,
      };
      store.projects = existing
        ? store.projects.map((p) => (p.id === id ? row : p))
        : [row, ...store.projects];
      writeStore(store);
      return undefined as T;
    }

    case "delete_project": {
      const id = str(a.id);
      store.projects = store.projects.filter((p) => p.id !== id);
      writeStore(store);
      return undefined as T;
    }

    case "open_folder_in_ide": {
      const path = str(a.path);
      const ideBin = str(a.ide_bin || a.ideBin, "code");
      console.info(`[browser mock] open_folder_in_ide → ${ideBin} "${path}"`);
      return undefined as T;
    }

    case "get_folders":
      return store.folders as T;

    case "add_folder": {
      const id = str(a.id, randomId());
      store.folders = [
        {
          id,
          name: str(a.name),
          path: str(a.path),
          preferred_ide: str(a.preferred_ide || a.preferredIde, "code") || null,
          description: str(a.description) || null,
          created_at: nowIso(),
        },
        ...store.folders,
      ];
      writeStore(store);
      return undefined as T;
    }

    case "delete_folder": {
      const id = str(a.id);
      store.folders = store.folders.filter((f) => f.id !== id);
      writeStore(store);
      return undefined as T;
    }

    case "get_vault_items":
      return publicVaultItems(store.vaultItems) as T;

    case "create_vault_item": {
      const id = str(a.id, randomId());
      store.vaultItems = [
        {
          id,
          item_type: str(a.item_type || a.itemType, "note"),
          title: str(a.title),
          created_at: nowIso(),
          passcode: str(a.passcode),
          plaintext: str(a.plaintext_data || a.plaintextData),
        },
        ...store.vaultItems,
      ];
      writeStore(store);
      return undefined as T;
    }

    case "unlock_vault_item": {
      const id = str(a.id);
      const passcode = str(a.passcode);
      const item = store.vaultItems.find((v) => v.id === id);
      if (!item) throw new Error("ITEM_NOT_FOUND");
      if (item.passcode !== passcode) {
        throw new Error("DECRYPTION_FAILED: Invalid passcode or corrupt data");
      }
      return item.plaintext as T;
    }

    case "update_vault_item": {
      const id = str(a.id);
      const passcode = str(a.passcode);
      const item = store.vaultItems.find((v) => v.id === id);
      if (!item) throw new Error("ITEM_NOT_FOUND");
      if (item.passcode !== passcode) {
        throw new Error("DECRYPTION_FAILED: Invalid passcode or corrupt data");
      }
      item.title = str(a.title, item.title);
      item.plaintext = str(a.plaintext_data || a.plaintextData, item.plaintext);
      writeStore(store);
      return undefined as T;
    }

    case "delete_vault_item": {
      const id = str(a.id);
      const passcode = str(a.passcode);
      const item = store.vaultItems.find((v) => v.id === id);
      if (!item) throw new Error("ITEM_NOT_FOUND");
      if (item.passcode !== passcode) {
        throw new Error("DECRYPTION_FAILED: Invalid passcode or corrupt data");
      }
      store.vaultItems = store.vaultItems.filter((v) => v.id !== id);
      writeStore(store);
      return undefined as T;
    }

    case "get_secure_files":
      return publicSecureFiles(store.secureFiles) as T;

    case "encrypt_file": {
      const id = str(a.id, randomId());
      const sourcePath = str(a.source_path || a.sourcePath, "mock-file.txt");
      const filename = sourcePath.split(/[/\\]/).pop() || "mock-file.txt";
      const content = `Mock encrypted content for ${filename}`;
      store.secureFiles = [
        {
          id,
          original_filename: filename,
          file_size: content.length,
          hint: str(a.hint),
          created_at: nowIso(),
          mime_type: filename.endsWith(".txt")
            ? "text/plain"
            : "application/octet-stream",
          encrypted_file_path: `browser-mock://${filename}.enc`,
          modified_at: String(Math.floor(Date.now() / 1000)),
          passcode: str(a.passcode),
          content_b64: btoa(content),
        },
        ...store.secureFiles,
      ];
      writeStore(store);
      return undefined as T;
    }

    case "decrypt_file_preview": {
      const id = str(a.id);
      const passcode = str(a.passcode);
      const file = store.secureFiles.find((f) => f.id === id);
      if (!file) throw new Error("FILE_RECORD_NOT_FOUND");
      if (file.passcode !== passcode) {
        throw new Error("DECRYPTION_FAILED: Invalid passcode or corrupt data");
      }
      return {
        original_filename: file.original_filename,
        mime: file.mime_type || "application/octet-stream",
        base64: file.content_b64,
      } as T;
    }

    case "decrypt_file": {
      const id = str(a.id);
      const passcode = str(a.passcode);
      const file = store.secureFiles.find((f) => f.id === id);
      if (!file) throw new Error("FILE_RECORD_NOT_FOUND");
      if (file.passcode !== passcode) {
        throw new Error("DECRYPTION_FAILED: Invalid passcode or corrupt data");
      }
      console.info(
        `[browser mock] decrypt_file → export "${str(a.export_path || a.exportPath)}"`,
      );
      return undefined as T;
    }

    case "delete_secure_file": {
      const id = str(a.id);
      const passcode = str(a.passcode);
      const file = store.secureFiles.find((f) => f.id === id);
      if (!file) throw new Error("FILE_RECORD_NOT_FOUND");
      if (file.passcode !== passcode) {
        throw new Error("DECRYPTION_FAILED: Invalid passcode or corrupt data");
      }
      store.secureFiles = store.secureFiles.filter((f) => f.id !== id);
      writeStore(store);
      return undefined as T;
    }

    case "generate_password": {
      const length = Number(a.length ?? 16);
      const chars =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      let out = "";
      for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out as T;
    }

    case "generate_passphrase": {
      const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];
      const count = Number(a.word_count ?? a.wordCount ?? 4);
      return Array.from(
        { length: count },
        () => words[Math.floor(Math.random() * words.length)],
      ).join("-") as T;
    }

    case "generate_jwt_secret":
    case "generate_generic_secret": {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
        "",
      ) as T;
    }

    default:
      throw new Error(
        `BROWSER_MOCK_UNSUPPORTED: No mock for command "${command}".`,
      );
  }
}

export async function mockOpen(options?: {
  directory?: boolean;
  multiple?: boolean;
}): Promise<string | string[] | null> {
  const hint = options?.directory
    ? "Enter a folder path (browser mock):"
    : "Enter a file path (browser mock):";
  const value = window.prompt(hint, "C:\\Users\\Gab\\Desktop\\DemoProject");
  if (!value) return null;
  return options?.multiple ? [value] : value;
}

export async function mockSave(options?: {
  defaultPath?: string;
}): Promise<string | null> {
  const value = window.prompt(
    "Enter save path (browser mock):",
    options?.defaultPath || "C:\\Users\\Gab\\Desktop\\export.txt",
  );
  return value || null;
}
