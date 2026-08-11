import { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Unlock,
  FileText,
  KeyRound,
  Plus,
  X,
  AlertTriangle,
  Pencil,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { isBrowserMockRuntime, safeInvoke } from "../../utils/tauri";

interface VaultItem {
  id: string;
  item_type: string;
  title: string;
  created_at: string;
}

type SessionEntry = {
  plaintext: string;
  passcode: string;
  title: string;
  itemType: string;
};

type StatusTone = "success" | "error" | "warning" | null;

const MAX_ATTEMPTS = 5;

function debugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  // #region agent log
  fetch("http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "05c7ae",
    },
    body: JSON.stringify({
      sessionId: "05c7ae",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId: "vault-post-fix",
    }),
  }).catch(() => {});
  // #endregion
}

export default function VaultList() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState("credential");
  const [newTitle, setNewTitle] = useState("");
  const [newPayload, setNewPayload] = useState("");
  const [newPasscode, setNewPasscode] = useState("");

  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [unlockPasscode, setUnlockPasscode] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [status, setStatus] = useState<{ tone: StatusTone; text: string }>({
    tone: null,
    text: "",
  });

  /** Unlocked-in-session items — survive modal close until explicit Lock */
  const [session, setSession] = useState<Record<string, SessionEntry>>({});
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPayload, setEditPayload] = useState("");
  const [authPasscode, setAuthPasscode] = useState("");
  const [pendingAction, setPendingAction] = useState<"edit" | "delete" | null>(
    null,
  );

  const browserMock = isBrowserMockRuntime();

  const fetchItems = async () => {
    try {
      const data = await safeInvoke<VaultItem[]>("get_vault_items");
      // File vault pointers belong in Secure Files, not this list
      setItems((data || []).filter((i) => i.item_type !== "file"));
    } catch (err) {
      setPageError(String(err));
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const resetUnlockForm = () => {
    setUnlockingId(null);
    setUnlockPasscode("");
    setAttemptsLeft(MAX_ATTEMPTS);
    setStatus({ tone: null, text: "" });
  };

  const closeViewKeepSession = () => {
    debugLog("V3", "VaultList.tsx:closeView", "Closed view without locking", {
      viewingId,
      sessionIds: Object.keys(session),
      keptInMemory: true,
    });
    setViewingId(null);
    setIsEditing(false);
    setPendingAction(null);
    setAuthPasscode("");
  };

  const lockItem = (id: string) => {
    debugLog("V3", "VaultList.tsx:lockItem", "Locked and cleared from memory", {
      id,
    });
    setSession((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setViewingId(null);
    setIsEditing(false);
    setPendingAction(null);
    setAuthPasscode("");
    resetUnlockForm();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscode) {
      setStatus({
        tone: "error",
        text: "A passcode is required to encrypt this item.",
      });
      return;
    }

    try {
      await safeInvoke("create_vault_item", {
        id: crypto.randomUUID(),
        itemType: newType,
        title: newTitle,
        plaintextData: newPayload,
        passcode: newPasscode,
      });
      setIsAdding(false);
      setNewTitle("");
      setNewPayload("");
      setNewPasscode("");
      setPageError(null);
      setStatus({ tone: "success", text: "Item encrypted and saved." });
      fetchItems();
    } catch (err) {
      setStatus({ tone: "error", text: String(err) });
    }
  };

  const openUnlockOrView = (item: VaultItem) => {
    if (session[item.id]) {
      debugLog("V3", "VaultList.tsx:reopenSession", "Reopened without passcode", {
        id: item.id,
        hadSession: true,
      });
      setViewingId(item.id);
      setIsEditing(false);
      setPendingAction(null);
      return;
    }
    setUnlockingId(item.id);
    setUnlockPasscode("");
    setAttemptsLeft(MAX_ATTEMPTS);
    setStatus({ tone: null, text: "" });
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockingId) return;
    if (attemptsLeft <= 0) {
      setStatus({
        tone: "warning",
        text: "Too many failed attempts. Wait a moment, then try again.",
      });
      return;
    }

    const item = items.find((i) => i.id === unlockingId);
    try {
      const data = await safeInvoke<string>("unlock_vault_item", {
        id: unlockingId,
        passcode: unlockPasscode,
      });

      debugLog("V1", "VaultList.tsx:unlock:success", "Unlock succeeded", {
        id: unlockingId,
        attemptsLeftBefore: attemptsLeft,
        hasStatusFeedback: true,
        opensModal: true,
      });

      setSession((prev) => ({
        ...prev,
        [unlockingId]: {
          plaintext: data,
          passcode: unlockPasscode,
          title: item?.title || "",
          itemType: item?.item_type || "note",
        },
      }));
      setStatus({ tone: "success", text: "Decryption successful." });
      setViewingId(unlockingId);
      setUnlockingId(null);
      setUnlockPasscode("");
      setAttemptsLeft(MAX_ATTEMPTS);
    } catch (err) {
      const next = attemptsLeft - 1;
      setAttemptsLeft(next);
      debugLog("V1", "VaultList.tsx:unlock:fail", "Unlock failed", {
        id: unlockingId,
        attemptsLeft: next,
        error: String(err),
      });
      if (next <= 0) {
        setStatus({
          tone: "warning",
          text: "5 failed attempts. Unlock temporarily locked for this item.",
        });
      } else {
        setStatus({
          tone: "error",
          text: `Incorrect passcode. ${next} attempt${next === 1 ? "" : "s"} remaining.`,
        });
      }
    }
  };

  const beginEdit = (id?: string) => {
    const targetId = id ?? viewingId;
    if (!targetId || !session[targetId]) return;
    setViewingId(targetId);
    setEditTitle(session[targetId].title);
    setEditPayload(session[targetId].plaintext);
    setIsEditing(true);
    setPendingAction("edit");
    setAuthPasscode("");
    setStatus({
      tone: "warning",
      text: "Enter passcode to confirm changes before saving.",
    });
  };

  const beginDelete = (id?: string) => {
    const targetId = id ?? viewingId;
    if (targetId) setViewingId(targetId);
    setPendingAction("delete");
    setAuthPasscode("");
    setStatus({
      tone: "warning",
      text: "Enter passcode to confirm permanent delete.",
    });
  };

  const confirmEdit = async () => {
    if (!viewingId || !session[viewingId]) return;
    try {
      await safeInvoke("update_vault_item", {
        id: viewingId,
        title: editTitle,
        plaintextData: editPayload,
        passcode: authPasscode,
      });
      setSession((prev) => ({
        ...prev,
        [viewingId]: {
          ...prev[viewingId],
          title: editTitle,
          plaintext: editPayload,
          passcode: authPasscode,
        },
      }));
      setIsEditing(false);
      setPendingAction(null);
      setAuthPasscode("");
      setStatus({ tone: "success", text: "Item updated and re-encrypted." });
      fetchItems();
    } catch (err) {
      setStatus({ tone: "error", text: String(err) });
    }
  };

  const confirmDelete = async () => {
    if (!viewingId) return;
    try {
      await safeInvoke("delete_vault_item", {
        id: viewingId,
        passcode: authPasscode,
      });
      setSession((prev) => {
        const next = { ...prev };
        delete next[viewingId];
        return next;
      });
      setViewingId(null);
      setPendingAction(null);
      setAuthPasscode("");
      setStatus({ tone: "success", text: "Item deleted." });
      fetchItems();
    } catch (err) {
      setStatus({ tone: "error", text: String(err) });
    }
  };

  const viewing = viewingId ? session[viewingId] : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {browserMock && (
        <div className="rounded border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          Browser mock — demo vault passcode is{" "}
          <code className="mx-1">demo1234</code>.
        </div>
      )}

      <div className="flex justify-between items-center border-b border-cyber-panel pb-4 gap-3 flex-wrap">
        <div className="flex items-center space-x-3">
          <Shield className="text-cyber-neonGreen w-6 h-6" />
          <div>
            <h3 className="text-2xl font-heading text-white">SECURE VAULT</h3>
            <p className="text-cyber-neonGreen opacity-70 font-mono text-sm mt-1">
              AES-256-GCM Encrypted Storage
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            debugLog("V4", "VaultList.tsx:add", "Open add modal", {
              hasModalWrapper: true,
            });
            setIsAdding(true);
            setStatus({ tone: null, text: "" });
          }}
          className="flex items-center space-x-2 bg-cyber-panel border border-cyber-neonGreen text-cyber-neonGreen px-4 py-2 hover:bg-cyber-neonGreen hover:text-black transition-colors"
        >
          <Plus size={18} />
          <span className="font-heading uppercase font-bold tracking-wider">
            Secure New Item
          </span>
        </button>
      </div>

      {pageError && (
        <div className="flex items-center space-x-3 bg-red-900/20 border border-red-500 text-red-400 p-3 font-mono text-sm">
          <AlertTriangle size={16} />
          <span>ERR: {pageError}</span>
        </div>
      )}

      {/* Item list always visible (modals overlay) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const unlocked = Boolean(session[item.id]);
          return (
            <div
              key={item.id}
              className="bg-cyber-dark border border-gray-800 p-4 hover:border-gray-500 transition-colors flex flex-col justify-between min-h-32"
            >
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  {item.item_type === "note" ? (
                    <FileText size={16} className="text-cyber-neonPink" />
                  ) : (
                    <KeyRound size={16} className="text-cyber-neonCyan" />
                  )}
                  <span className="font-mono text-xs text-gray-400 uppercase">
                    {item.item_type === "note" ? "Secure Note" : "Credential"}
                  </span>
                  {unlocked && (
                    <span className="ml-auto text-[10px] font-mono uppercase text-cyber-neonGreen border border-cyber-neonGreen/40 px-1.5 py-0.5">
                      Unlocked
                    </span>
                  )}
                </div>
                <h4 className="font-heading text-lg tracking-wide text-white truncate">
                  {session[item.id]?.title || item.title}
                </h4>
              </div>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={() => openUnlockOrView(item)}
                  className="flex items-center space-x-1 text-xs font-mono text-cyber-neonGreen hover:text-white"
                >
                  {unlocked ? <Unlock size={14} /> : <Lock size={14} />}
                  <span>{unlocked ? "View" : "Unlock"}</span>
                </button>
                <button
                  onClick={() => {
                    if (unlocked) {
                      beginEdit(item.id);
                    } else {
                      setUnlockingId(item.id);
                      setPendingAction(null);
                      setAttemptsLeft(MAX_ATTEMPTS);
                      setUnlockPasscode("");
                      setStatus({
                        tone: "warning",
                        text: "Unlock the item first, then use Edit.",
                      });
                    }
                  }}
                  className="flex items-center space-x-1 text-xs font-mono text-cyber-neonCyan hover:text-white"
                >
                  <Pencil size={14} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
                    if (unlocked) {
                      beginDelete(item.id);
                    } else {
                      setUnlockingId(item.id);
                      setPendingAction("delete");
                      setAttemptsLeft(MAX_ATTEMPTS);
                      setUnlockPasscode("");
                      setStatus({
                        tone: "warning",
                        text: "Enter passcode to delete this item.",
                      });
                    }
                  }}
                  className="flex items-center space-x-1 text-xs font-mono text-red-400 hover:text-white"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-cyber-panel text-gray-500 font-mono">
            NO ENCRYPTED ITEMS IN STORAGE
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {isAdding && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdding(false);
          }}
        >
          <form
            onSubmit={handleSave}
            className="bg-cyber-panel p-6 border border-cyber-neonGreen/50 space-y-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center border-b border-gray-700 pb-2">
              <h4 className="font-heading text-lg text-cyber-neonGreen uppercase tracking-wide">
                Encrypt New Item
              </h4>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-gray-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-gray-400 uppercase">
                  Item Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-cyber-dark border border-gray-700 text-white p-2 font-mono focus:border-cyber-neonGreen outline-none"
                >
                  <option value="credential">Credential</option>
                  <option value="note">Secure Note</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-gray-400 uppercase">
                  Title
                </label>
                <input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-cyber-dark border border-gray-700 text-white p-2 font-mono focus:border-cyber-neonGreen outline-none"
                  placeholder="e.g., Production DB Password"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-gray-400 uppercase">
                Secret Content
              </label>
              <textarea
                required
                value={newPayload}
                onChange={(e) => setNewPayload(e.target.value)}
                className="w-full h-32 bg-cyber-dark border border-gray-700 text-white p-2 font-mono focus:border-cyber-neonGreen outline-none resize-none"
                placeholder="Enter the sensitive information here."
              />
            </div>

            <div className="space-y-1 border-t border-gray-700 pt-4">
              <label className="text-xs font-mono text-cyber-neonYellow uppercase flex items-center space-x-2">
                <KeyRound size={14} /> <span>Encryption Passcode</span>
              </label>
              <input
                type="password"
                required
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                className="w-full bg-cyber-dark border border-cyber-neonYellow text-white p-2 font-mono focus:border-cyber-neonGreen outline-none"
                placeholder="Create a strong passcode for this item"
              />
            </div>

            {status.tone && isAdding && (
              <StatusBanner tone={status.tone} text={status.text} />
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-cyber-neonGreen text-black px-6 py-2 font-bold font-heading uppercase"
              >
                Encrypt & Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unlock Modal */}
      {unlockingId && !viewingId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (pendingAction === "delete") {
                try {
                  await safeInvoke("delete_vault_item", {
                    id: unlockingId,
                    passcode: unlockPasscode,
                  });
                  setStatus({ tone: "success", text: "Item deleted." });
                  resetUnlockForm();
                  setPendingAction(null);
                  fetchItems();
                } catch (err) {
                  const next = attemptsLeft - 1;
                  setAttemptsLeft(Math.max(0, next));
                  setStatus({
                    tone: next <= 0 ? "warning" : "error",
                    text:
                      next <= 0
                        ? "5 failed attempts. Try again later."
                        : `Incorrect passcode. ${next} attempt${next === 1 ? "" : "s"} remaining.`,
                  });
                }
                return;
              }
              await handleUnlock(e);
            }}
            className="bg-cyber-panel border border-cyber-neonCyan p-6 w-full max-w-md relative"
          >
            <button
              type="button"
              onClick={() => {
                resetUnlockForm();
                setPendingAction(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <Lock className="w-12 h-12 text-cyber-neonCyan mx-auto mb-2 opacity-80" />
              <h3 className="font-heading text-xl uppercase tracking-wider text-white">
                {pendingAction === "delete" ? "Confirm Delete" : "Unlock Item"}
              </h3>
              <p className="font-mono text-xs text-gray-400 mt-2">
                {pendingAction === "delete"
                  ? "Enter passcode to permanently delete this item"
                  : "Enter passcode to decrypt"}
              </p>
              <p className="font-mono text-xs text-gray-500 mt-1">
                Attempts remaining: {attemptsLeft}/{MAX_ATTEMPTS}
              </p>
            </div>

            {status.tone && <StatusBanner tone={status.tone} text={status.text} />}

            <input
              type="password"
              required
              autoFocus
              disabled={attemptsLeft <= 0}
              value={unlockPasscode}
              onChange={(e) => setUnlockPasscode(e.target.value)}
              className="w-full bg-cyber-dark border border-cyber-neonCyan text-white p-3 font-mono text-center text-xl tracking-[0.3em] focus:border-white outline-none mb-4 disabled:opacity-50"
              placeholder="••••••••"
            />

            <button
              type="submit"
              disabled={attemptsLeft <= 0}
              className="w-full bg-cyber-neonCyan text-black p-3 font-bold font-heading uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
            >
              {pendingAction === "delete" ? "Delete Item" : "Decrypt"}
            </button>
          </form>
        </div>
      )}

      {/* View / Edit Modal */}
      {viewingId && viewing && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeViewKeepSession();
          }}
        >
          <div className="bg-cyber-dark border border-cyber-neonGreen p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={closeViewKeepSession}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
              title="Close (keeps unlocked in session)"
            >
              <X size={20} />
            </button>

            <div className="flex items-center space-x-2 text-cyber-neonGreen mb-4 border-b border-gray-800 pb-2 pr-8">
              <Unlock size={18} />
              <h4 className="font-heading uppercase tracking-wide font-bold">
                {isEditing ? "Edit Item" : "Decrypted Successfully"}
              </h4>
            </div>

            {status.tone && (
              <div className="mb-4">
                <StatusBanner tone={status.tone} text={status.text} />
              </div>
            )}

            {isEditing ? (
              <div className="space-y-3">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-black border border-gray-700 text-white p-2 font-mono"
                  placeholder="Title"
                />
                <textarea
                  value={editPayload}
                  onChange={(e) => setEditPayload(e.target.value)}
                  className="w-full h-40 bg-black border border-gray-700 text-white p-2 font-mono resize-none"
                />
              </div>
            ) : (
              <pre className="font-mono text-sm text-white whitespace-pre-wrap selection:bg-cyber-neonGreen selection:text-black">
                {viewing.plaintext}
              </pre>
            )}

            {(pendingAction === "edit" || pendingAction === "delete") && (
              <div className="mt-4 space-y-2 border-t border-gray-800 pt-4">
                <label className="text-xs font-mono text-cyber-neonYellow uppercase">
                  Confirm with passcode
                </label>
                <input
                  type="password"
                  value={authPasscode}
                  onChange={(e) => setAuthPasscode(e.target.value)}
                  className="w-full bg-black border border-cyber-neonYellow text-white p-2 font-mono"
                  placeholder="••••••••"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAction(null);
                      setIsEditing(false);
                      setAuthPasscode("");
                      setStatus({ tone: null, text: "" });
                    }}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-sm"
                  >
                    Cancel
                  </button>
                  {pendingAction === "edit" ? (
                    <button
                      type="button"
                      onClick={confirmEdit}
                      className="px-3 py-2 bg-cyber-neonCyan text-black font-bold text-sm"
                    >
                      Save Changes
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={confirmDelete}
                      className="px-3 py-2 bg-red-900/40 border border-red-700 text-red-300 text-sm"
                    >
                      Confirm Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {!pendingAction && (
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => beginEdit()}
                  className="flex items-center gap-1 text-xs font-mono text-cyber-neonCyan hover:text-white uppercase tracking-wider"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => beginDelete()}
                  className="flex items-center gap-1 text-xs font-mono text-red-400 hover:text-white uppercase tracking-wider"
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button
                  onClick={() => lockItem(viewingId)}
                  className="flex items-center gap-1 text-xs font-mono text-gray-400 hover:text-white uppercase tracking-wider ml-auto"
                >
                  <Lock size={14} /> Lock & clear from memory
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBanner({
  tone,
  text,
}: {
  tone: Exclude<StatusTone, null>;
  text: string;
}) {
  const styles =
    tone === "success"
      ? "bg-green-900/20 border-green-500 text-green-300"
      : tone === "warning"
        ? "bg-amber-900/20 border-amber-500 text-amber-200"
        : "bg-red-900/20 border-red-500 text-red-300";

  return (
    <div
      className={`flex items-start gap-2 border p-3 font-mono text-sm mb-4 ${styles}`}
    >
      {tone === "success" ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      )}
      <span>{text}</span>
    </div>
  );
}
