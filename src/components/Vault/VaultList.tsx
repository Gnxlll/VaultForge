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
} from "lucide-react";
import { safeInvoke } from "../../utils/tauri";

interface VaultItem {
  id: string;
  item_type: string;
  title: string;
  created_at: string;
}

export default function VaultList() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // State for creating a new item
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState("credential");
  const [newTitle, setNewTitle] = useState("");
  const [newPayload, setNewPayload] = useState("");
  const [newPasscode, setNewPasscode] = useState("");

  // State for unlocking an item
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [unlockPasscode, setUnlockPasscode] = useState("");
  const [decryptedData, setDecryptedData] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const data = await safeInvoke<VaultItem[]>("get_vault_items");
      setItems(data);
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscode) {
      setError("A passcode is required to encrypt this item.");
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
      setError(null);
      fetchItems();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await safeInvoke<string>("unlock_vault_item", {
        id: unlockingId,
        passcode: unlockPasscode,
      });
      setDecryptedData(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const closeUnlock = () => {
    setUnlockingId(null);
    setUnlockPasscode("");
    setDecryptedData(null);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Actions */}
      <div className="flex justify-between items-center border-b border-cyber-panel pb-4">
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
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 bg-cyber-panel border border-cyber-neonGreen text-cyber-neonGreen px-4 py-2 hover:bg-cyber-neonGreen hover:text-black transition-colors shadow-[0_0_10px_rgba(10,255,0,0.2)]"
        >
          {isAdding ? <X size={18} /> : <Plus size={18} />}
          <span className="font-heading uppercase font-bold tracking-wider">
            {isAdding ? "Cancel" : "Secure New Item"}
          </span>
        </button>
      </div>

      {error && (
        <div className="flex items-center space-x-3 bg-red-900/20 border border-red-500 text-red-400 p-3 font-mono text-sm animate-pulse">
          <AlertTriangle size={16} />
          <span>ERR: {error}</span>
        </div>
      )}

      {/* Add Item Form */}
      {isAdding && (
        <form
          onSubmit={handleSave}
          className="bg-cyber-panel p-6 border border-cyber-neonGreen/50 space-y-4"
        >
          <h4 className="font-heading text-lg text-cyber-neonGreen uppercase tracking-wide border-b border-gray-700 pb-2">
            Encrypt New Payload
          </h4>

          <div className="grid grid-cols-2 gap-4">
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
              Payload (Secret Data)
            </label>
            <textarea
              required
              value={newPayload}
              onChange={(e) => setNewPayload(e.target.value)}
              className="w-full h-32 bg-cyber-dark border border-gray-700 text-white p-2 font-mono focus:border-cyber-neonGreen outline-none resize-none"
              placeholder="Enter the sensitive information here. This will be encrypted before storage."
            />
          </div>

          <div className="space-y-1 border-t border-gray-700 pt-4 mt-2">
            <label className="text-xs font-mono text-cyber-neonYellow uppercase flex items-center space-x-2">
              <KeyRound size={14} /> <span>Encryption Passcode</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                required
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                className="flex-1 bg-cyber-dark border border-cyber-neonYellow text-white p-2 font-mono focus:border-cyber-neonGreen outline-none"
                placeholder="Create a strong passcode for this specific item"
              />
              <button
                type="submit"
                className="bg-cyber-neonGreen text-black px-8 font-bold font-heading uppercase hover:bg-white transition-colors"
              >
                Encrypt & Save
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Unlock Modal Overlay */}
      {unlockingId && !decryptedData && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUnlock}
            className="bg-cyber-panel border border-cyber-neonCyan p-6 w-full max-w-md relative"
          >
            <button
              type="button"
              onClick={closeUnlock}
              className="absolute top-4 right-4 text-gray-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <Lock className="w-12 h-12 text-cyber-neonCyan mx-auto mb-2 opacity-80" />
              <h3 className="font-heading text-xl uppercase tracking-wider text-white">
                Unlock Vault Item
              </h3>
              <p className="font-mono text-xs text-gray-400 mt-2">
                Authentication required for decryption
              </p>
            </div>

            <input
              type="password"
              required
              autoFocus
              value={unlockPasscode}
              onChange={(e) => setUnlockPasscode(e.target.value)}
              className="w-full bg-cyber-dark border border-cyber-neonCyan text-white p-3 font-mono text-center text-xl tracking-[0.3em] focus:border-white outline-none mb-4"
              placeholder="••••••••"
            />

            <button
              type="submit"
              className="w-full bg-cyber-neonCyan text-black p-3 font-bold font-heading uppercase tracking-widest hover:bg-white transition-colors"
            >
              Decrypt Payload
            </button>
          </form>
        </div>
      )}

      {/* Decrypted Payload View */}
      {decryptedData && (
        <div className="bg-cyber-dark border border-cyber-neonGreen p-6 relative">
          <button
            onClick={closeUnlock}
            className="absolute top-4 right-4 text-gray-500 hover:text-white"
          >
            <X size={20} />
          </button>
          <div className="flex items-center space-x-2 text-cyber-neonGreen mb-4 border-b border-gray-800 pb-2">
            <Unlock size={18} />
            <h4 className="font-heading uppercase tracking-wide font-bold">
              Payload Decrypted Successfully
            </h4>
          </div>
          <pre className="font-mono text-sm text-white whitespace-pre-wrap selection:bg-cyber-neonGreen selection:text-black">
            {decryptedData}
          </pre>
          <button
            onClick={closeUnlock}
            className="mt-6 text-xs font-mono text-gray-500 hover:text-white uppercase tracking-wider"
          >
            [ Lock and clear from memory ]
          </button>
        </div>
      )}

      {/* Item List Grid */}
      {!decryptedData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-cyber-dark border border-gray-800 p-4 hover:border-gray-500 transition-colors flex flex-col justify-between h-32"
            >
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  {item.item_type === "note" ? (
                    <FileText size={16} className="text-cyber-neonPink" />
                  ) : (
                    <KeyRound size={16} className="text-cyber-neonCyan" />
                  )}
                  <span className="font-mono text-xs text-gray-400 uppercase">
                    {item.item_type}
                  </span>
                </div>
                <h4 className="font-heading text-lg tracking-wide text-white truncate">
                  {item.title}
                </h4>
              </div>

              <button
                onClick={() => setUnlockingId(item.id)}
                className="flex items-center space-x-2 text-xs font-mono text-cyber-neonGreen hover:text-white mt-4"
              >
                <Lock size={14} />
                <span>[ UNLOCK_PAYLOAD ]</span>
              </button>
            </div>
          ))}

          {items.length === 0 && !isAdding && (
            <div className="col-span-full py-12 text-center border border-dashed border-cyber-panel text-gray-500 font-mono">
              NO ENCRYPTED ITEMS IN STORAGE
            </div>
          )}
        </div>
      )}
    </div>
  );
}
