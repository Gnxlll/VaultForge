import React, { useEffect, useState } from "react";
import { safeInvoke } from "../../utils/tauri";
import ProjectForm from "./ProjectForm";
import ConfirmModal from "../UI/ConfirmModal";

type ProjectInfo = {
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

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProjectInfo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectInfo | null>(null);

  const load = async () => {
    try {
      const res = await safeInvoke<ProjectInfo[]>("get_projects");
      setProjects(res || []);
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-heading">Projects</h2>
        <div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(!showForm);
            }}
            className="bg-blue-900/30 text-blue-400 border border-blue-700 px-4 py-2"
          >
            New Project
          </button>
        </div>
      </div>

      {showForm && (
        <ProjectForm
          initial={editing || {}}
          onSave={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <div
            key={p.id}
            className="bg-gray-900 border border-gray-700 p-4 rounded-lg"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                <div className="text-sm text-gray-400">{p.path}</div>
                <div className="text-xs text-gray-500 mt-2">{p.tags}</div>
              </div>
              <div className="text-right space-y-2">
                <div className="text-sm text-gray-300">{p.ide}</div>
                <div className="text-xs text-gray-500">{p.status}</div>
                <div className="flex space-x-2 justify-end mt-3">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setShowForm(true);
                    }}
                    className="text-blue-400 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setPendingDelete(p);
                      setConfirmOpen(true);
                    }}
                    className="text-red-400 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Delete Project"
        message={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.name}"? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDelete(null);
        }}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await safeInvoke("delete_project", { id: pendingDelete.id });
            setConfirmOpen(false);
            setPendingDelete(null);
            load();
          } catch (err) {
            console.error("Failed to delete project", err);
          }
        }}
      />
    </div>
  );
}
