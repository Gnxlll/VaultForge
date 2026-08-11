import { useEffect, useState } from "react";
import { FolderOpen, Save, Star } from "lucide-react";
import { safeOpen, safeInvoke } from "../../utils/tauri";

type ProjectFormProps = {
  initial?: Partial<Record<string, any>>;
  onSave?: (data: Record<string, any>) => void;
  onCancel?: () => void;
};

export default function ProjectForm({
  initial = {},
  onSave,
  onCancel,
}: ProjectFormProps) {
  const [formData, setFormData] = useState({
    id: initial.id || "",
    name: initial.name || "",
    path: initial.path || "",
    ide: initial.ide || "VS Code",
    status: initial.status || "Active",
    favorite: initial.favorite || false,
    tags: initial.tags || "",
    notes: initial.notes || "",
  });

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "05c7ae",
      },
      body: JSON.stringify({
        sessionId: "05c7ae",
        hypothesisId: "H5",
        location: "ProjectForm.tsx:syncInitial",
        message: "Form synced from initial prop",
        data: {
          initialId: initial.id || null,
          initialName: initial.name || null,
          initialIde: initial.ide || null,
        },
        timestamp: Date.now(),
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion
    setFormData({
      id: initial.id || "",
      name: initial.name || "",
      path: initial.path || "",
      ide: initial.ide || "VS Code",
      status: initial.status || "Active",
      favorite: initial.favorite || false,
      tags: initial.tags || "",
      notes: initial.notes || "",
    });
  }, [initial]);

  const browseFolder = async () => {
    try {
      const selected = await safeOpen({ directory: true, multiple: false });
      if (selected && typeof selected === "string") {
        setFormData((prev) => ({ ...prev, path: selected }));
      }
    } catch (err) {
      console.error("Folder selection cancelled or failed", err);
    }
  };

  const handleSave = async () => {
    try {
      const id =
        formData.id ||
        (crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString());
      await safeInvoke("save_project", {
        id,
        name: formData.name,
        path: formData.path,
        ide: formData.ide,
        status: formData.status,
        favorite: formData.favorite,
        tags: formData.tags,
        notes: formData.notes,
      });

      setFormData((prev) => ({ ...prev, id }));
      if (onSave) onSave({ ...formData, id });
    } catch (err) {
      console.error("Failed to save project", err);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 text-sm sm:border-0 sm:rounded-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-400 mb-1">Project Name</label>
          <input
            type="text"
            className="w-full bg-black border border-gray-700 p-2 text-white"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-gray-400 mb-1">Open With (IDE)</label>
          <select
            className="w-full bg-black border border-gray-700 p-2 text-white"
            value={formData.ide}
            onChange={(e) => setFormData({ ...formData, ide: e.target.value })}
          >
            <option>VS Code</option>
            <option>Cursor</option>
            <option>Windsurf</option>
            <option>System Default</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-gray-400 mb-1">
            Project Folder Location
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              className="flex-1 min-w-0 bg-black border border-gray-700 p-2 text-gray-300"
              value={formData.path}
              placeholder="Click Browse..."
            />
            <button
              type="button"
              onClick={browseFolder}
              className="bg-blue-900/30 text-blue-400 border border-blue-700 px-4 flex items-center justify-center shrink-0"
            >
              <FolderOpen size={16} className="mr-2" /> Browse
            </button>
          </div>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">Status</label>
          <select
            className="w-full bg-black border border-gray-700 p-2 text-white"
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value })
            }
          >
            <option>Active</option>
            <option>Archived</option>
            <option>On Hold</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-400 mb-1">Labels / Tags</label>
          <input
            type="text"
            className="w-full bg-black border border-gray-700 p-2 text-white"
            placeholder="e.g. react, internal"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setFormData({ ...formData, favorite: !formData.favorite })
          }
          className={`flex items-center space-x-2 ${formData.favorite ? "text-yellow-500" : "text-gray-500"}`}
        >
          <Star size={18} fill={formData.favorite ? "currentColor" : "none"} />
          <span>Mark as Favorite</span>
        </button>
        <div className="flex flex-wrap gap-2 justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-gray-800 border border-gray-700 text-gray-300 px-4 py-2"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="bg-green-900/30 text-green-400 border border-green-700 px-6 py-2 flex items-center"
          >
            <Save size={16} className="mr-2" /> Save Project
          </button>
        </div>
      </div>
    </div>
  );
}
