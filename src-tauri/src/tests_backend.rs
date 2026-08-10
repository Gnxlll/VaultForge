#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{Connection, params};

    // Bring schema module into scope
    use crate::database::schema;

    #[test]
    fn test_migration_copies_folders_to_projects() {
        // Create an in-memory DB
        let conn = Connection::open_in_memory().expect("open in-memory");

        // Manually create folders table and insert a row BEFORE running init_tables
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                description TEXT,
                preferred_ide TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_opened_at DATETIME
            );",
        ).expect("create folders");

        let id = "test-folder-1";
        conn.execute(
            "INSERT INTO folders (id, name, path, preferred_ide) VALUES (?1, ?2, ?3, ?4)",
            params![id, "My Project", "C:/projects/myproj", "VS Code"],
        ).expect("insert folder");

        // Now call init_tables which includes the migration copying folders -> projects
        schema::init_tables(&conn).expect("init tables");

        // Verify the projects table contains the copied row
        let mut stmt = conn.prepare("SELECT id, name, path, ide FROM projects WHERE id = ?1").expect("prepare");
        let mut rows = stmt.query(params![id]).expect("query");
        let row = rows.next().expect("get row").expect("row ok");

        let got_id: String = row.get(0).expect("id");
        let got_name: String = row.get(1).expect("name");
        let got_path: String = row.get(2).expect("path");
        let got_ide: String = row.get(3).expect("ide");

        assert_eq!(got_id, id);
        assert_eq!(got_name, "My Project");
        assert_eq!(got_path, "C:/projects/myproj");
        assert_eq!(got_ide, "VS Code");
    }

    #[test]
    fn test_projects_table_crud_sql() {
        let conn = Connection::open_in_memory().expect("open in-memory");
        // Initialize tables (creates projects table)
        schema::init_tables(&conn).expect("init tables");

        // Insert a project
        let id = "proj-123";
        conn.execute(
            "INSERT INTO projects (id, name, path, ide, status, favorite, tags, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, "Test", "C:/tmp/test", "VS Code", "Active", 0, "tag1,tag2", "notes"],
        ).expect("insert project");

        // Read it back
        let mut stmt = conn.prepare("SELECT name, path FROM projects WHERE id = ?1").expect("prepare");
        let mut rows = stmt.query(params![id]).expect("query");
        let row = rows.next().expect("get row").expect("row ok");
        let name: String = row.get(0).expect("name");
        let path: String = row.get(1).expect("path");
        assert_eq!(name, "Test");
        assert_eq!(path, "C:/tmp/test");

        // Update project
        conn.execute("UPDATE projects SET name = ?1 WHERE id = ?2", params!["Updated", id]).expect("update");
        let new_name: String = conn.query_row("SELECT name FROM projects WHERE id = ?1", params![id], |r| r.get(0)).expect("query_row");
        assert_eq!(new_name, "Updated");

        // Delete
        conn.execute("DELETE FROM projects WHERE id = ?1", params![id]).expect("delete");
        let count: i64 = conn.query_row("SELECT COUNT(1) FROM projects WHERE id = ?1", params![id], |r| r.get(0)).expect("count");
        assert_eq!(count, 0);
    }
}
