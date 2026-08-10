use rusqlite::{Connection, Result};

pub fn init_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            description TEXT,
            preferred_ide TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_opened_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            ide TEXT NOT NULL,
            status TEXT DEFAULT 'Active',
            favorite INTEGER DEFAULT 0,
            tags TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS vault_items (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            encrypted_data BLOB NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS secure_files (
            id TEXT PRIMARY KEY,
            vault_item_id TEXT REFERENCES vault_items(id) ON DELETE CASCADE,
            original_filename TEXT NOT NULL,
            encrypted_file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT,
            salt BLOB NOT NULL,
            nonce BLOB NOT NULL,
            hint TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        -- Safe migration: copy folders into projects if projects are missing
        INSERT INTO projects (id, name, path, ide, status, favorite, tags, notes, created_at, updated_at)
        SELECT id, name, path, IFNULL(preferred_ide, 'VS Code'), 'Active', 0, '', '', created_at, updated_at
        FROM folders
        WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.id = folders.id);
        "
    )?;

    // (migration already performed above in the execute_batch SQL)
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn migration_copies_folders_into_projects() {
        let conn = Connection::open_in_memory().expect("open in memory");

        // create folders table and insert a sample row
        conn.execute_batch(
            "
            CREATE TABLE folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                preferred_ide TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO folders (id, name, path, preferred_ide) VALUES ('f1', 'MyProj', '/tmp/myproj', 'VS Code');
            ",
        ).expect("create folders and insert");

        // run init_tables which includes the migration
        init_tables(&conn).expect("init tables");

        // now assert project row exists
        let mut stmt = conn.prepare("SELECT id, name, path, ide FROM projects WHERE id = 'f1'").expect("prepare");
        let row = stmt.query_row([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?))).expect("query row");

        assert_eq!(row.0, "f1");
        assert_eq!(row.1, "MyProj");
        assert_eq!(row.2, "/tmp/myproj");
        assert_eq!(row.3, "VS Code");
    }
}