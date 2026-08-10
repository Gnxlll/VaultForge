import { useState, useEffect } from "react";
import {
  FileLock2,
  Upload,
  Download,
  AlertCircle,
  File,
  Lock,
  X,
} from "lucide-react";
import { safeInvoke, safeOpen, safeSave } from "../../utils/tauri";

interface SecureFile {
  id: string;
  original_filename: string;
  file_size: number;
  hint: string;
  created_at: string;
}

export default function SecureFiles() {
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Encrypt State
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [hint, setHint] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Decrypt State
  const [unlockingFile, setUnlockingFile] = useState<SecureFile | null>(null);
  const [unlockPasscode, setUnlockPasscode] = useState("");

  const fetchFiles = async () => {
    try {
      const data = await safeInvoke<SecureFile[]>("get_secure_files");
      setFiles(data);
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleSelectFile = async () => {
    try {
      const selected = await safeOpen({
        multiple: false,
        title: "Select File to Encrypt",
      });
      if (selected) {
        setSelectedPath(selected as string);
        setIsAdding(true);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPath || !passcode || !hint) return;

    // Security constraint: Hint cannot equal passcode
    if (passcode.toLowerCase() === hint.toLowerCase()) {
      setError("SECURITY_VIOLATION: The hint must not be your password.");
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
      setError(null);
      fetchFiles();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockingFile || !unlockPasscode) return;

    let exportPath: string | null;

    try {
      // Ask where to save the decrypted file
      exportPath = await safeSave({
        defaultPath: unlockingFile.original_filename,
        title: "Export Decrypted File",
      });
    } catch (err) {
      setError(String(err));
      return;
    }

    if (!exportPath) return; // User cancelled

    setIsProcessing(true);
    try {
      await safeInvoke("decrypt_file", {
        id: unlockingFile.id,
        passcode: unlockPasscode,
        exportPath,
      });

      setUnlockingFile(null);
      setUnlockPasscode("");
      setError(null);

      // Temporary success state would go here
      alert("File decrypted and exported successfully!");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center border-b border-cyber-panel pb-4">
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
          className="flex items-center space-x-2 bg-cyber-panel border border-cyber-neonYellow text-cyber-neonYellow px-4 py-2 hover:bg-cyber-neonYellow hover:text-black transition-colors shadow-[0_0_10px_rgba(252,238,10,0.2)] disabled:opacity-50"
        >
          <Upload size={18} />
          <span className="font-heading uppercase font-bold tracking-wider">
            Encrypt File
          </span>
        </button>
      </div>

      {error && (
        <div className="flex items-center space-x-3 bg-red-900/20 border border-red-500 text-red-400 p-3 font-mono text-sm animate-pulse">
          <AlertCircle size={16} />
          <span>ERR: {error}</span>
        </div>
      )}

      {/* Encryption Flow Modal */}
      {isAdding && selectedPath && (
        <div className="bg-cyber-panel p-6 border border-cyber-neonYellow/50 space-y-4">
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
              {isProcessing
                ? "ENCRYPTING PAYLOAD..."
                : "ENCRYPT & STORE LOCALLY"}
            </button>
          </form>
        </div>
      )}

      {/* Decryption Flow Overlay */}
      {unlockingFile && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleDecrypt}
            className="bg-cyber-panel border border-cyber-neonYellow p-6 w-full max-w-md relative"
          >
            <button
              type="button"
              onClick={() => {
                setUnlockingFile(null);
                setUnlockPasscode("");
                setError(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <Lock className="w-12 h-12 text-cyber-neonYellow mx-auto mb-2 opacity-80" />
              <h3 className="font-heading text-xl uppercase tracking-wider text-white">
                Decrypt File
              </h3>
              <p className="font-mono text-xs text-cyber-neonYellow mt-2">
                Hint: {unlockingFile.hint}
              </p>
            </div>

            <input
              type="password"
              required
              autoFocus
              value={unlockPasscode}
              onChange={(e) => setUnlockPasscode(e.target.value)}
              className="w-full bg-cyber-dark border border-cyber-neonYellow text-white p-3 font-mono text-center text-xl tracking-[0.3em] focus:border-white outline-none mb-4"
              placeholder="••••••••"
            />

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-cyber-neonYellow text-black p-3 font-bold font-heading uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
            >
              {isProcessing ? "DECRYPTING..." : "UNLOCK & EXPORT"}
            </button>
          </form>
        </div>
      )}

      {/* File Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((f) => (
          <div
            key={f.id}
            className="bg-cyber-dark border border-gray-800 p-4 hover:border-gray-500 transition-colors flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <File size={16} className="text-cyber-neonYellow" />
                <span className="font-mono text-xs text-gray-400">
                  {formatBytes(f.file_size)}
                </span>
              </div>
              <h4
                className="font-heading text-lg tracking-wide text-white truncate"
                title={f.original_filename}
              >
                {f.original_filename}
              </h4>
            </div>

            <button
              onClick={() => setUnlockingFile(f)}
              className="flex items-center space-x-2 text-xs font-mono text-cyber-neonYellow hover:text-white mt-6 opacity-80 group-hover:opacity-100 transition-opacity"
            >
              <Download size={14} />
              <span>[ DECRYPT_AND_EXPORT ]</span>
            </button>
          </div>
        ))}

        {files.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center border border-dashed border-cyber-panel text-gray-500 font-mono">
            NO SECURE FILES IN STORAGE
          </div>
        )}
      </div>
    </div>
  );
}
