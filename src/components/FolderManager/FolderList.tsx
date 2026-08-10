import { useState, useEffect } from "react";
import { Folder, Code, Trash2, Plus, TerminalSquare } from "lucide-react";
import { safeInvoke } from "../../utils/tauri";

interface ProjectFolder {
  id: string;
  name: string;
  path: string;
  description: string | null;
  preferred_ide: string | null;
}

export default function FolderList() {
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newIde, setNewIde] = useState("code");

  const fetchFolders = async () => {
    try {
      const data = await safeInvoke<ProjectFolder[]>("get_folders");
      setFolders(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await safeInvoke("add_folder", {
        id: crypto.randomUUID(),
        name: newName,
        path: newPath,
        description: null,
        preferredIde: newIde,
      });
      setIsAdding(false);
      setNewName("");
      setNewPath("");
      fetchFolders();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await safeInvoke("delete_folder", { id });
      fetchFolders();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleLaunchIDE = async (path: string, ide: string) => {
    try {
      await safeInvoke("open_folder_in_ide", { path, ideBin: ide });
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center border-b border-cyber-panel pb-4">
        <div>
          <h3 className="text-2xl font-heading text-white">
            SYSTEM DIRECTORIES
          </h3>
          <p className="text-cyber-neonCyan opacity-70 font-mono text-sm mt-1">
            Manage local workspaces
          </p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 bg-cyber-panel border border-cyber-neonCyan text-cyber-neonCyan px-4 py-2 hover:bg-cyber-neonCyan hover:text-black transition-colors shadow-neon-cyan"
        >
          <Plus size={18} />
          <span className="font-heading uppercase font-bold tracking-wider">
            Mount Folder
          </span>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-400 p-3 font-mono text-sm animate-pulse">
          ERR: {error}
        </div>
      )}

      {/* Add Folder Form */}
      {isAdding && (
        <form
          onSubmit={handleAddFolder}
          className="bg-cyber-panel p-4 border border-cyber-dim grid grid-cols-1 md:grid-cols-3 gap-4 relative overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-neonYellow"></div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-mono text-gray-400 uppercase">
              Project Name
            </label>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-cyber-dark border border-gray-700 text-white p-2 font-mono text-sm focus:border-cyber-neonCyan outline-none"
              placeholder="e.g., Nexus Protocol"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-mono text-gray-400 uppercase">
              Absolute Path
            </label>
            <input
              required
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              className="bg-cyber-dark border border-gray-700 text-white p-2 font-mono text-sm focus:border-cyber-neonCyan outline-none"
              placeholder="C:\Projects\nexus-protocol"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-mono text-gray-400 uppercase">
              IDE Binary Alias
            </label>
            <div className="flex space-x-2">
              <input
                required
                value={newIde}
                onChange={(e) => setNewIde(e.target.value)}
                className="bg-cyber-dark border border-gray-700 text-white p-2 font-mono text-sm focus:border-cyber-neonCyan outline-none flex-1"
                placeholder="code, idea, cursor"
              />
              <button
                type="submit"
                className="bg-cyber-neonCyan text-black px-4 font-bold font-heading hover:bg-white transition-colors"
              >
                SAVE
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Folder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className="bg-cyber-dark border border-cyber-panel p-4 group hover:border-cyber-neonCyan/50 transition-colors relative"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3">
                <Folder className="text-cyber-neonPink w-5 h-5" />
                <h4 className="font-heading text-lg font-bold tracking-wide">
                  {folder.name}
                </h4>
              </div>
              <button
                onClick={() => handleDelete(folder.id)}
                className="text-gray-600 hover:text-red-500 transition-colors"
                title="Delete Record"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <p
              className="font-mono text-xs text-gray-500 mb-4 truncate"
              title={folder.path}
            >
              {folder.path}
            </p>

            <div className="flex justify-end border-t border-cyber-panel pt-3">
              <button
                onClick={() =>
                  handleLaunchIDE(folder.path, folder.preferred_ide || "code")
                }
                className="flex items-center space-x-2 text-xs font-mono text-cyber-neonCyan hover:text-white transition-colors"
              >
                <Code size={14} />
                <span>
                  LAUNCH_{folder.preferred_ide?.toUpperCase() || "IDE"}
                </span>
              </button>
            </div>
          </div>
        ))}

        {folders.length === 0 && !isAdding && (
          <div className="col-span-full py-12 text-center border border-dashed border-cyber-panel text-gray-500 font-mono flex flex-col items-center">
            <TerminalSquare className="w-8 h-8 mb-2 opacity-50" />
            <p>NO DIRECTORIES MOUNTED IN VAULTFORGE</p>
          </div>
        )}
      </div>
    </div>
  );
}
