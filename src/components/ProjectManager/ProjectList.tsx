import { useEffect, useState } from "react";
import { safeInvoke, isBrowserMockRuntime } from "../../utils/tauri";
import { ideDisplayLabel, resolveIdeBin } from "../../utils/ide";
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
  const [openFeedback, setOpenFeedback] = useState<string | null>(null);
  const browserMock = isBrowserMockRuntime();

  const load = async () => {
    try {
      const res = await safeInvoke<ProjectInfo[]>("get_projects");
      setProjects(res || []);
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!openFeedback) return;
    const t = window.setTimeout(() => setOpenFeedback(null), 3500);
    return () => window.clearTimeout(t);
  }, [openFeedback]);

  // #region agent log
  useEffect(() => {
    const measureCards = () => {
      const cards = document.querySelectorAll("[data-project-card]");
      const samples = Array.from(cards).slice(0, 3).map((el) => {
        const rect = el.getBoundingClientRect();
        const actions = el.querySelector("[data-project-actions]");
        const actionsRect = actions?.getBoundingClientRect();
        return {
          cardWidth: Math.round(rect.width),
          cardRight: Math.round(rect.right),
          actionsRight: actionsRect ? Math.round(actionsRect.right) : null,
          overflowPx:
            actionsRect != null
              ? Math.round(actionsRect.right - rect.right)
              : null,
          viewportWidth: window.innerWidth,
        };
      });
      fetch("http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "05c7ae",
        },
        body: JSON.stringify({
          sessionId: "05c7ae",
          hypothesisId: "H2",
          location: "ProjectList.tsx:layout",
          message: "project card layout metrics",
          data: {
            showForm,
            editingId: editing?.id ?? null,
            formIsInline: false,
            hasModalWrapper: showForm,
            browserMock,
            sampleCount: samples.length,
            samples,
          },
          timestamp: Date.now(),
          runId: "post-fix",
        }),
      }).catch(() => {});
    };
    measureCards();
    window.addEventListener("resize", measureCards);
    return () => window.removeEventListener("resize", measureCards);
  }, [projects, showForm, editing, browserMock]);
  // #endregion

  const handleOpenInIde = async (p: ProjectInfo) => {
    const ideBin = resolveIdeBin(p.ide);
    const looksLikeDisplayName =
      /\s/.test(p.ide || "") ||
      ["VS Code", "Cursor", "Windsurf", "System Default"].includes(p.ide);

    // #region agent log
    fetch("http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "05c7ae",
      },
      body: JSON.stringify({
        sessionId: "05c7ae",
        hypothesisId: "H3,H4",
        location: "ProjectList.tsx:Open",
        message: "Open IDE invoke attempt",
        data: {
          path: p.path,
          storedIde: p.ide,
          ideBinPassed: ideBin,
          argKeyUsed: "ideBin",
          looksLikeDisplayName,
          mappedFromDisplayName: looksLikeDisplayName,
          browserMock,
        },
        timestamp: Date.now(),
        runId: "post-fix",
      }),
    }).catch(() => {});
    // #endregion

    try {
      await safeInvoke("open_folder_in_ide", {
        path: p.path,
        ideBin,
      });
      // #region agent log
      fetch("http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "05c7ae",
        },
        body: JSON.stringify({
          sessionId: "05c7ae",
          hypothesisId: "H3,H4",
          location: "ProjectList.tsx:Open:success",
          message: "Open IDE invoke succeeded",
          data: { ideBinPassed: ideBin, browserMock },
          timestamp: Date.now(),
          runId: "post-fix",
        }),
      }).catch(() => {});
      // #endregion
      setOpenFeedback(
        browserMock
          ? `Browser mock: would open with ${ideDisplayLabel(p.ide)} (${ideBin})`
          : `Opening in ${ideDisplayLabel(p.ide)}…`,
      );
    } catch (err) {
      // #region agent log
      fetch("http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "05c7ae",
        },
        body: JSON.stringify({
          sessionId: "05c7ae",
          hypothesisId: "H3,H4",
          location: "ProjectList.tsx:Open:error",
          message: "Open IDE invoke failed",
          data: {
            error: String(err),
            storedIde: p.ide,
            ideBinPassed: ideBin,
            argKeyUsed: "ideBin",
          },
          timestamp: Date.now(),
          runId: "post-fix",
        }),
      }).catch(() => {});
      // #endregion
      console.error("Failed to open project in IDE", err);
      setOpenFeedback(`Failed to open: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {browserMock && (
        <div className="rounded border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          Browser mock mode — data is stored in localStorage. Real IDE launch
          and file crypto need <code className="mx-1">npm run tauri dev</code>.
        </div>
      )}

      {openFeedback && (
        <div className="rounded border border-green-700/50 bg-green-950/30 px-3 py-2 text-sm text-green-300">
          {openFeedback}
        </div>
      )}

      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-heading">Projects</h2>
        <button
          onClick={() => {
            // #region agent log
            fetch(
              "http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Debug-Session-Id": "05c7ae",
                },
                body: JSON.stringify({
                  sessionId: "05c7ae",
                  hypothesisId: "H1",
                  location: "ProjectList.tsx:NewProject",
                  message: "New Project clicked — form mode",
                  data: {
                    nextShowForm: true,
                    clearingEdit: true,
                    renderingInline: false,
                    hasModalWrapper: true,
                  },
                  timestamp: Date.now(),
                  runId: "post-fix",
                }),
              },
            ).catch(() => {});
            // #endregion
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-blue-900/30 text-blue-400 border border-blue-700 px-4 py-2"
        >
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <div
            key={p.id}
            data-project-card
            className="bg-gray-900 border border-gray-700 p-4 rounded-lg min-w-0 overflow-hidden"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-white break-words">
                  {p.name}
                </h3>
                <div className="text-sm text-gray-400 break-all">{p.path}</div>
                {p.tags ? (
                  <div className="text-xs text-gray-500 mt-2 break-words">
                    {p.tags}
                  </div>
                ) : null}
              </div>
              <div
                className="shrink-0 w-full sm:w-auto sm:max-w-[14rem] space-y-2 sm:text-right"
                data-project-actions
              >
                <div className="text-sm text-gray-300">
                  IDE:{" "}
                  <span className="text-white font-medium">
                    {ideDisplayLabel(p.ide)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{p.status}</div>
                <div className="flex flex-wrap gap-2 sm:justify-end mt-1">
                  <button
                    onClick={() => {
                      // #region agent log
                      fetch(
                        "http://127.0.0.1:7780/ingest/3fd2728b-1abb-4f47-ba4e-7877e9d97f54",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "X-Debug-Session-Id": "05c7ae",
                          },
                          body: JSON.stringify({
                            sessionId: "05c7ae",
                            hypothesisId: "H5",
                            location: "ProjectList.tsx:Edit",
                            message: "Edit clicked — opens modal",
                            data: {
                              formWasOpen: showForm,
                              previousEditingId: editing?.id ?? null,
                              nextEditingId: p.id,
                              nextEditingName: p.name,
                              sharesSameInlineForm: false,
                              opensModal: true,
                            },
                            timestamp: Date.now(),
                            runId: "post-fix",
                          }),
                        },
                      ).catch(() => {});
                      // #endregion
                      setEditing(p);
                      setShowForm(true);
                    }}
                    className="text-blue-400 text-sm px-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleOpenInIde(p)}
                    className="text-green-400 text-sm px-1"
                    title={`Open folder in ${ideDisplayLabel(p.ide)}`}
                  >
                    Open in {ideDisplayLabel(p.ide)}
                  </button>
                  <button
                    onClick={() => {
                      setPendingDelete(p);
                      setConfirmOpen(true);
                    }}
                    className="text-red-400 text-sm px-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "Edit project" : "New project"}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
              <h3 className="text-lg font-bold text-white">
                {editing ? "Edit Project" : "New Project"}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="text-gray-400 hover:text-white px-2 py-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-2 sm:p-0">
              <ProjectForm
                key={editing?.id ?? "new"}
                initial={editing || {}}
                onCancel={closeForm}
                onSave={() => {
                  closeForm();
                  load();
                }}
              />
            </div>
          </div>
        </div>
      )}

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
