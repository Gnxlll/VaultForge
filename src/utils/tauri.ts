import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
};

export function isTauriRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as TauriWindow;
  return Boolean(tauriWindow.__TAURI_INTERNALS__ || tauriWindow.__TAURI__);
}

export async function safeInvoke<T>(
  command: string,
  args?: unknown,
): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error(
      "TAURI_BRIDGE_UNAVAILABLE: This action requires the desktop runtime.",
    );
  }

  return invoke<T>(command, args as Record<string, unknown> | undefined);
}

export async function safeOpen(options?: Parameters<typeof open>[0]) {
  if (!isTauriRuntime()) {
    throw new Error(
      "TAURI_BRIDGE_UNAVAILABLE: File selection requires the desktop runtime.",
    );
  }

  return open(options);
}

export async function safeSave(options?: Parameters<typeof save>[0]) {
  if (!isTauriRuntime()) {
    throw new Error(
      "TAURI_BRIDGE_UNAVAILABLE: File export requires the desktop runtime.",
    );
  }

  return save(options);
}
