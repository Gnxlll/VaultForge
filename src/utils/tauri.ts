import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  mockInvoke,
  mockOpen,
  mockSave,
} from "./tauriBrowserMock";

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

/** True when UI runs in a normal browser without the Tauri desktop bridge. */
export function isBrowserMockRuntime() {
  return !isTauriRuntime();
}

export async function safeInvoke<T>(
  command: string,
  args?: unknown,
): Promise<T> {
  if (!isTauriRuntime()) {
    return mockInvoke<T>(command, args);
  }

  return invoke<T>(command, args as Record<string, unknown> | undefined);
}

export async function safeOpen(options?: Parameters<typeof open>[0]) {
  if (!isTauriRuntime()) {
    return mockOpen(options as { directory?: boolean; multiple?: boolean });
  }

  return open(options);
}

export async function safeSave(options?: Parameters<typeof save>[0]) {
  if (!isTauriRuntime()) {
    return mockSave(options as { defaultPath?: string });
  }

  return save(options);
}
