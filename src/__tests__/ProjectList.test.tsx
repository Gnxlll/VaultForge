import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ProjectList from "../components/ProjectManager/ProjectList";
import * as tauri from "../utils/tauri";
import { vi } from "vitest";

describe("ProjectList delete flow", () => {
  it("loads projects and deletes one after confirmation", async () => {
    const projects = [
      {
        id: "p1",
        name: "MyProj",
        path: "/tmp/myproj",
        ide: "VS Code",
        status: "Active",
        favorite: 0,
        tags: "react",
        notes: "",
        created_at: "",
        updated_at: "",
      },
    ];

    const safeInvokeSpy = vi.spyOn(tauri, "safeInvoke");
    // mock implementation: first call get_projects, second call delete_project, third call get_projects
    let callCount = 0;
    safeInvokeSpy.mockImplementation((cmd: string) => {
      callCount++;
      if (cmd === "get_projects") return Promise.resolve(projects);
      if (cmd === "delete_project") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    render(<ProjectList />);

    // wait for project to appear
    await waitFor(() => expect(screen.getByText("MyProj")).toBeDefined());

    // click Delete button
    const deleteBtn = screen.getByText("Delete");
    fireEvent.click(deleteBtn);

    // modal appears with Confirm button
    const confirmBtn = await screen.findByTestId("confirm-ok");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(safeInvokeSpy).toHaveBeenCalledWith("delete_project", {
        id: "p1",
      });
    });

    safeInvokeSpy.mockRestore();
  });
});
