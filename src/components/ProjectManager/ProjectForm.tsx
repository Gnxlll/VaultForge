import React, { useEffect, useState } from "react";
import { FolderOpen, Save, Star } from "lucide-react";
import { safeOpen, safeInvoke } from "../../utils/tauri";

type ProjectFormProps = {
  initial?: Partial<Record<string, any>>;
  onSave?: (data: Record<string, any>) => void;
};

export default function ProjectForm({
  initial = {},
  onSave,
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

  React.useEffect(() => {
    // Sync when `initial` prop changes (for edit flows)
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

  useEffect(() => {
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
        setFormData({ ...formData, path: selected });
      }
    } catch (err) {
      console.error("Folder selection cancelled or failed", err);
    }
  };

  const handleSave = async () => {
    try {
      const id =
        formData.id ||
        (crypto && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
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

      setFormData({ ...formData, id });
      if (onSave) onSave({ ...formData, id });
    } catch (err) {
      console.error("Failed to save project", err);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 text-sm">
      <div className="grid grid-cols-2 gap-4">
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

        <div className="col-span-2">
          <label className="block text-gray-400 mb-1">
            Project Folder Location
          </label>
          <div className="flex space-x-2">
            <input
              readOnly
              className="flex-1 bg-black border border-gray-700 p-2 text-gray-300"
              value={formData.path}
              placeholder="Click Browse..."
            />
            <button
              onClick={browseFolder}
              className="bg-blue-900/30 text-blue-400 border border-blue-700 px-4 flex items-center"
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

      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={() =>
            setFormData({ ...formData, favorite: !formData.favorite })
          }
          className={`flex items-center space-x-2 ${formData.favorite ? "text-yellow-500" : "text-gray-500"}`}
        >
          <Star size={18} fill={formData.favorite ? "currentColor" : "none"} />
          <span>Mark as Favorite</span>
        </button>
        <button
          onClick={handleSave}
          className="bg-green-900/30 text-green-400 border border-green-700 px-6 py-2 flex items-center"
        >
          <Save size={16} className="mr-2" /> Save Project
        </button>
      </div>
    </div>
  );
}
