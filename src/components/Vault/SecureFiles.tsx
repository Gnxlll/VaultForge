import { useState, useEffect } from "react";
import {
  FileLock2,
  Upload,
  Download,
  AlertCircle,
  File,
  Lock,
  X,
  Trash2,
  Unlock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  isBrowserMockRuntime,
  safeInvoke,
  safeOpen,
  safeSave,
} from "../../utils/tauri";

interface SecureFile {
  id: string;
  original_filename: string;
  file_size: number;
  hint: string;
  created_at: string;
  mime_type?: string | null;
  encrypted_file_path?: string;
  modified_at?: string | null;
}

type PreviewData = {
  mime: string;
  base64: string;
  filename: string;
};

type SessionEntry = {
  preview: PreviewData;
  passcode: string;
  file: SecureFile;
};

type StatusTone = "success" | "error" | "warning" | null;

const MAX_ATTEMPTS = 5;

const TEXT_LIKE = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "text/html",
  "text/xml",
  "application/xml",
]);

function isTextPreview(mime: string) {
  return TEXT_LIKE.has(mime) || mime.startsWith("text/");
}

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
      className={`flex items-start gap-2 border p-3 font-mono text-sm ${styles}`}
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

export default function SecureFiles() {
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [hint, setHint] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [unlockingFile, setUnlockingFile] = useState<SecureFile | null>(null);
  const [unlockPasscode, setUnlockPasscode] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [status, setStatus] = useState<{ tone: StatusTone; text: string }>({
    tone: null,
    text: "",
  });

  const [session, setSession] = useState<Record<string, SessionEntry>>({});
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [authPasscode, setAuthPasscode] = useState("");

  const browserMock = isBrowserMockRuntime();

  const fetchFiles = async () => {
    try {
      const data = await safeInvoke<SecureFile[]>("get_secure_files");
      setFiles(data);
    } catch (err) {
      setPageError(String(err));
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleSelectFile = async () => {
    try {
      const selected = await safeOpen({
        multiple: false,
        title: "Select File to Encrypt",
      });
      if (selected) {
        setSelectedPath(selected as string);
        setIsAdding(true);
        setStatus({ tone: null, text: "" });
      }
    } catch (err) {
      setPageError(String(err));
    }
  };

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPath || !passcode || !hint) return;

    if (passcode.toLowerCase() === hint.toLowerCase()) {
      setStatus({
        tone: "error",
        text: "SECURITY_VIOLATION: The hint must not be your password.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await safeInvoke("encrypt_file", {
        id: crypto.randomUUID(),
        sourcePath: selectedPath,
        passcode,
        hint,
      });
      setIsAdding(false);
      setSelectedPath(null);
      setPasscode("");
      setHint("");
      setPageError(null);
      setStatus({ tone: "success", text: "File encrypted and stored locally." });
      fetchFiles();
    } catch (err) {
      setStatus({ tone: "error", text: String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const openUnlockOrView = (file: SecureFile) => {
    if (session[file.id]) {
      debugLog("V2", "SecureFiles.tsx:reopenSession", "Reopened without passcode", {
        id: file.id,
        mime: session[file.id].preview.mime,
      });
      setViewingId(file.id);
      setStatus({ tone: null, text: "" });
      return;
    }
    setUnlockingFile(file);
    setUnlockPasscode("");
    setAttemptsLeft(MAX_ATTEMPTS);
    setStatus({ tone: null, text: "" });
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockingFile || !unlockPasscode) return;
    if (attemptsLeft <= 0) {
      setStatus({
        tone: "warning",
        text: "Too many failed attempts. Try again later.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await safeInvoke<{
        original_filename: string;
        mime: string;
        base64: string;
      }>("decrypt_file_preview", {
        id: unlockingFile.id,
        passcode: unlockPasscode,
      });

      const preview: PreviewData = {
        mime: res.mime,
        base64: res.base64,
        filename: res.original_filename,
      };

      debugLog("V1,V2", "SecureFiles.tsx:decrypt:success", "Decrypt preview ok", {
        id: unlockingFile.id,
        mime: preview.mime,
        isText: isTextPreview(preview.mime),
        isImage: preview.mime.startsWith("image/"),
        isPdf: preview.mime === "application/pdf",
        hasInlinePreview:
          isTextPreview(preview.mime) ||
          preview.mime.startsWith("image/") ||
          preview.mime === "application/pdf",
      });

      setSession((prev) => ({
        ...prev,
        [unlockingFile.id]: {
          preview,
          passcode: unlockPasscode,
          file: unlockingFile,
        },
      }));
      setStatus({ tone: "success", text: "Decryption successful." });
      setViewingId(unlockingFile.id);
      setUnlockingFile(null);
      setUnlockPasscode("");
      setAttemptsLeft(MAX_ATTEMPTS);
    } catch (err) {
      const next = attemptsLeft - 1;
      setAttemptsLeft(next);
      debugLog("V1", "SecureFiles.tsx:decrypt:fail", "Decrypt failed", {
        attemptsLeft: next,
        error: String(err),
      });
      setStatus({
        tone: next <= 0 ? "warning" : "error",
        text:
          next <= 0
            ? "5 failed attempts. Unlock temporarily locked for this file."
            : `Incorrect passcode. ${next} attempt${next === 1 ? "" : "s"} remaining.`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const closeViewKeepSession = () => {
    debugLog("V3", "SecureFiles.tsx:closeView", "Closed without locking", {
      viewingId,
      keptInMemory: true,
    });
    setViewingId(null);
    setPendingDeleteId(null);
    setAuthPasscode("");
  };

  const lockFile = (id: string) => {
    setSession((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setViewingId(null);
    setPendingDeleteId(null);
    setAuthPasscode("");
    setStatus({ tone: "success", text: "File locked and cleared from memory." });
  };

  const handleExport = async (id: string) => {
    const entry = session[id];
    if (!entry) return;

    let exportPath: string | null;
    try {
      exportPath = await safeSave({
        defaultPath: entry.preview.filename,
        title: "Export Decrypted File",
      });
    } catch (err) {
      setStatus({ tone: "error", text: String(err) });
      return;
    }
    if (!exportPath) return;

    setIsProcessing(true);
    try {
      await safeInvoke("decrypt_file", {
        id,
        passcode: entry.passcode,
        exportPath,
      });
      setStatus({
        tone: "success",
        text: browserMock
          ? `Browser mock: would export to ${exportPath}`
          : "File exported successfully.",
      });
    } catch (err) {
      setStatus({ tone: "error", text: String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadInBrowser = (id: string) => {
    const entry = session[id];
    if (!entry) return;
    const link = document.createElement("a");
    link.href = `data:${entry.preview.mime};base64,${entry.preview.base64}`;
    link.download = entry.preview.filename;
    link.click();
    setStatus({
      tone: "success",
      text: `Download started for ${entry.preview.filename}`,
    });
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId || viewingId;
    if (!id) return;
    try {
      await safeInvoke("delete_secure_file", {
        id,
        passcode: authPasscode || session[id]?.passcode || "",
      });
      setSession((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setViewingId(null);
      setPendingDeleteId(null);
      setUnlockingFile(null);
      setAuthPasscode("");
      setStatus({ tone: "success", text: "Secure file deleted." });
      fetchFiles();
    } catch (err) {
      setStatus({ tone: "error", text: String(err) });
    }
  };

  const viewing = viewingId ? session[viewingId] : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {browserMock && (
        <div className="rounded border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          Browser mock — demo file passcode is{" "}
          <code className="mx-1">demo1234</code> (hint: demo hint).
        </div>
      )}

      <div className="flex justify-between items-center border-b border-cyber-panel pb-4 gap-3 flex-wrap">
        <div className="flex items-center space-x-3">
          <FileLock2 className="text-cyber-neonYellow w-6 h-6" />
          <div>
            <h3 className="text-2xl font-heading text-white">
              SECURE FILE VAULT
            </h3>
            <p className="text-cyber-neonYellow opacity-70 font-mono text-sm mt-1">
              Local AES-256-GCM File Encryption
            </p>
          </div>
        </div>
        <button
          onClick={handleSelectFile}
          disabled={isProcessing}
          className="flex items-center space-x-2 bg-cyber-panel border border-cyber-neonYellow text-cyber-neonYellow px-4 py-2 hover:bg-cyber-neonYellow hover:text-black transition-colors disabled:opacity-50"
        >
          <Upload size={18} />
          <span className="font-heading uppercase font-bold tracking-wider">
            Encrypt File
          </span>
        </button>
      </div>

      {pageError && (
        <div className="flex items-center space-x-3 bg-red-900/20 border border-red-500 text-red-400 p-3 font-mono text-sm">
          <AlertCircle size={16} />
          <span>ERR: {pageError}</span>
        </div>
      )}

      {status.tone && !isAdding && !unlockingFile && !viewingId && (
        <StatusBanner tone={status.tone} text={status.text} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((f) => {
          const unlocked = Boolean(session[f.id]);
          return (
            <div
              key={f.id}
              className="bg-cyber-dark border border-gray-800 p-4 hover:border-gray-500 transition-colors flex flex-col justify-between group min-w-0"
            >
              <div className="min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <File size={16} className="text-cyber-neonYellow shrink-0" />
                  <span className="font-mono text-xs text-gray-400">
                    {formatBytes(f.file_size)}
                  </span>
                  {unlocked && (
                    <span className="ml-auto text-[10px] font-mono uppercase text-cyber-neonYellow border border-cyber-neonYellow/40 px-1.5 py-0.5">
                      Unlocked
                    </span>
                  )}
                </div>
                <h4
                  className="font-heading text-lg tracking-wide text-white truncate"
                  title={f.original_filename}
                >
                  {f.original_filename}
                </h4>
                <p className="text-xs text-gray-500 font-mono mt-1 truncate">
                  Hint: {f.hint}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  onClick={() => openUnlockOrView(f)}
                  className="flex items-center space-x-1 text-xs font-mono text-cyber-neonYellow hover:text-white"
                >
                  {unlocked ? <Unlock size={14} /> : <Lock size={14} />}
                  <span>{unlocked ? "View" : "Unlock"}</span>
                </button>
                <button
                  onClick={() => {
                    if (unlocked) {
                      setViewingId(f.id);
                      handleExport(f.id);
                    } else {
                      openUnlockOrView(f);
                      setStatus({
                        tone: "warning",
                        text: "Unlock the file first, then export.",
                      });
                    }
                  }}
                  className="flex items-center space-x-1 text-xs font-mono text-cyber-neonCyan hover:text-white"
                >
                  <Download size={14} />
                  <span>Export</span>
                </button>
                <button
                  onClick={() => {
                    setPendingDeleteId(f.id);
                    if (unlocked) {
                      setViewingId(f.id);
                      setAuthPasscode("");
                      setStatus({
                        tone: "warning",
                        text: "Enter passcode to confirm delete.",
                      });
                    } else {
                      setUnlockingFile(f);
                      setUnlockPasscode("");
                      setAttemptsLeft(MAX_ATTEMPTS);
                      setStatus({
                        tone: "warning",
                        text: "Enter passcode to delete this file.",
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

        {files.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-cyber-panel text-gray-500 font-mono">
            NO SECURE FILES IN STORAGE
          </div>
        )}
      </div>

      {/* Encrypt Modal */}
      {isAdding && selectedPath && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdding(false);
          }}
        >
          <div className="bg-cyber-panel p-6 border border-cyber-neonYellow/50 space-y-4 w-full max-w-xl">
            <div className="flex justify-between items-center border-b border-gray-700 pb-2">
              <h4 className="font-heading text-lg text-cyber-neonYellow uppercase tracking-wide">
                Configure File Protection
              </h4>
              <button
                onClick={() => setIsAdding(false)}
                className="text-gray-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-cyber-dark p-3 font-mono text-sm text-gray-400 border border-gray-800 break-all">
              <span className="text-cyber-neonYellow mr-2">TARGET:</span>{" "}
              {selectedPath}
            </div>

            {status.tone && (
              <StatusBanner tone={status.tone} text={status.text} />
            )}

            <form onSubmit={handleEncrypt} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-gray-400 uppercase">
                    Encryption Passcode
                  </label>
                  <input
                    type="password"
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full bg-cyber-dark border border-gray-700 text-white p-2 font-mono focus:border-cyber-neonYellow outline-none"
                    placeholder="Create a strong password"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono text-gray-400 uppercase">
                    Passcode Hint (Required)
                  </label>
                  <input
                    type="text"
                    required
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    className="w-full bg-cyber-dark border border-gray-700 text-white p-2 font-mono focus:border-cyber-neonYellow outline-none"
                    placeholder="A clue to remember this passcode"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-cyber-neonYellow text-black p-3 font-bold font-heading uppercase hover:bg-white transition-colors disabled:opacity-50"
              >
                {isProcessing ? "ENCRYPTING..." : "ENCRYPT & STORE LOCALLY"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Unlock / Delete-auth Modal */}
      {unlockingFile && !viewingId && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (pendingDeleteId === unlockingFile.id) {
                setAuthPasscode(unlockPasscode);
                try {
                  await safeInvoke("delete_secure_file", {
                    id: unlockingFile.id,
                    passcode: unlockPasscode,
                  });
                  setStatus({ tone: "success", text: "Secure file deleted." });
                  setUnlockingFile(null);
                  setPendingDeleteId(null);
                  setUnlockPasscode("");
                  fetchFiles();
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
              await handleDecrypt(e);
            }}
            className="bg-cyber-panel border border-cyber-neonYellow p-6 w-full max-w-md relative"
          >
            <button
              type="button"
              onClick={() => {
                setUnlockingFile(null);
                setUnlockPasscode("");
                setPendingDeleteId(null);
                setStatus({ tone: null, text: "" });
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <Lock className="w-12 h-12 text-cyber-neonYellow mx-auto mb-2 opacity-80" />
              <h3 className="font-heading text-xl uppercase tracking-wider text-white">
                {pendingDeleteId === unlockingFile.id
                  ? "Confirm Delete"
                  : "Unlock File"}
              </h3>
              <p className="font-mono text-xs text-cyber-neonYellow mt-2">
                Hint: {unlockingFile.hint}
              </p>
              <p className="font-mono text-xs text-gray-500 mt-1">
                Attempts remaining: {attemptsLeft}/{MAX_ATTEMPTS}
              </p>
            </div>

            {status.tone && (
              <div className="mb-4">
                <StatusBanner tone={status.tone} text={status.text} />
              </div>
            )}

            <input
              type="password"
              required
              autoFocus
              disabled={attemptsLeft <= 0}
              value={unlockPasscode}
              onChange={(e) => setUnlockPasscode(e.target.value)}
              className="w-full bg-cyber-dark border border-cyber-neonYellow text-white p-3 font-mono text-center text-xl tracking-[0.3em] focus:border-white outline-none mb-4 disabled:opacity-50"
              placeholder="••••••••"
            />

            <button
              type="submit"
              disabled={isProcessing || attemptsLeft <= 0}
              className="w-full bg-cyber-neonYellow text-black p-3 font-bold font-heading uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
            >
              {pendingDeleteId === unlockingFile.id
                ? "Delete File"
                : isProcessing
                  ? "DECRYPTING..."
                  : "Decrypt"}
            </button>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {viewingId && viewing && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeViewKeepSession();
          }}
        >
          <div className="bg-cyber-panel border border-cyber-neonYellow p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={closeViewKeepSession}
              className="absolute top-4 right-4 text-gray-500 hover:text-white z-10"
              title="Close (keeps unlocked in session)"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 text-cyber-neonYellow mb-4 border-b border-gray-800 pb-2 pr-8">
              <Unlock size={18} />
              <h4 className="font-heading uppercase tracking-wide font-bold">
                Decryption Successful
              </h4>
            </div>

            {status.tone && (
              <div className="mb-4">
                <StatusBanner tone={status.tone} text={status.text} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-black/40 p-4 rounded max-h-[60vh] overflow-auto min-w-0">
                <div className="text-xs text-gray-400 mb-2">
                  Preview: {viewing.preview.filename}
                </div>
                {viewing.preview.mime.startsWith("image/") ? (
                  <img
                    src={`data:${viewing.preview.mime};base64,${viewing.preview.base64}`}
                    alt={viewing.preview.filename}
                    className="max-h-[50vh] mx-auto"
                  />
                ) : isTextPreview(viewing.preview.mime) ? (
                  <pre className="bg-black/50 p-3 rounded text-sm overflow-auto max-h-[50vh] whitespace-pre-wrap">
                    {atob(viewing.preview.base64)}
                  </pre>
                ) : viewing.preview.mime === "application/pdf" ? (
                  <object
                    data={`data:application/pdf;base64,${viewing.preview.base64}`}
                    type="application/pdf"
                    className="w-full h-[50vh]"
                  >
                    <div className="p-6 border border-gray-700 text-sm text-gray-300">
                      PDF preview unavailable. Use Export / Download to open the
                      file.
                    </div>
                  </object>
                ) : (
                  <div className="p-6 border border-gray-700 text-sm text-gray-300 space-y-3">
                    <p>
                      No inline preview for{" "}
                      <span className="font-mono text-cyber-neonYellow">
                        {viewing.preview.mime}
                      </span>
                      .
                    </p>
                    <p>
                      Export or download the decrypted file to open it with the
                      appropriate app.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        browserMock
                          ? downloadInBrowser(viewingId)
                          : handleExport(viewingId)
                      }
                      className="bg-cyber-neonYellow text-black px-4 py-2 font-bold"
                    >
                      {browserMock ? "Download File" : "Export File"}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-cyber-dark p-4 border border-cyber-neonYellow/40 rounded text-sm space-y-3">
                <Meta label="File name" value={viewing.preview.filename} />
                <Meta
                  label="File size"
                  value={formatBytes(viewing.file.file_size)}
                />
                <Meta label="File type" value={viewing.preview.mime} />
                <Meta
                  label="Location"
                  value={viewing.file.encrypted_file_path ?? "—"}
                />
                <Meta label="Hint" value={viewing.file.hint} />
                <Meta label="Encryption" value="AES-256-GCM" />

                {pendingDeleteId === viewingId ? (
                  <div className="space-y-2 border-t border-gray-800 pt-3">
                    <label className="text-xs font-mono text-cyber-neonYellow uppercase">
                      Confirm delete with passcode
                    </label>
                    <input
                      type="password"
                      value={authPasscode}
                      onChange={(e) => setAuthPasscode(e.target.value)}
                      className="w-full bg-black border border-cyber-neonYellow text-white p-2 font-mono"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDeleteId(null);
                          setAuthPasscode("");
                          setStatus({ tone: null, text: "" });
                        }}
                        className="flex-1 bg-gray-800 p-2 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmDelete}
                        className="flex-1 bg-red-900/40 border border-red-700 text-red-300 p-2 text-sm"
                      >
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        browserMock
                          ? downloadInBrowser(viewingId)
                          : handleExport(viewingId)
                      }
                      disabled={isProcessing}
                      className="w-full bg-cyber-neonYellow text-black p-2 font-bold disabled:opacity-50"
                    >
                      {isProcessing
                        ? "WORKING..."
                        : browserMock
                          ? "Download"
                          : "Export"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingDeleteId(viewingId);
                        setAuthPasscode("");
                        setStatus({
                          tone: "warning",
                          text: "Enter passcode to confirm delete.",
                        });
                      }}
                      className="w-full border border-red-700 text-red-300 p-2 text-sm"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => lockFile(viewingId)}
                      className="w-full bg-gray-800 p-2 text-sm text-gray-300"
                    >
                      Lock & clear from memory
                    </button>
                    <button
                      type="button"
                      onClick={closeViewKeepSession}
                      className="w-full text-xs text-gray-500 hover:text-white py-1"
                    >
                      Close (keep unlocked in session)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-white font-mono break-all text-xs">{value}</div>
    </div>
  );
}
