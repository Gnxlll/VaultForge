# VaultForge

VaultForge is a desktop application for securely storing project metadata, secrets, and files. It uses a Rust/Tauri backend with an SQLite database and a React + TypeScript frontend built with Vite and Tailwind.

## Tech stack

- Backend: Rust + Tauri
- Database: SQLite (rusqlite)
- Frontend: React + TypeScript, Vite, Tailwind CSS
- Bundling: Tauri for native desktop builds

## Key features

- Project management (create, edit, delete projects)
- Vault for secrets and secure files (encryption handled in Rust)
- Password and secret generators with configurable options
- File operations via Tauri commands

## Quick start (development)

Prerequisites: Node.js, npm (or yarn), Rust toolchain (rustup + cargo). On Windows ensure build tools required by Tauri are installed.

1. Install frontend dependencies:

```bash
npm install
```

2. Run the frontend dev server:

```bash
npm run dev
```

3. Run backend tests (from the project root):

```bash
cd src-tauri
cargo test
```

4. Run the full Tauri app in dev mode (when ready):

```bash
npm run tauri dev
```

## Build

```bash
npm run build
cd src-tauri
cargo build --release
tauri build
```

## Tests

- Frontend: `npm test` (Vitest)
- Backend: `cargo test` in `src-tauri`

## Important files & locations

- Frontend source: `src/`
  - Project UI: `src/components/ProjectManager`
  - Password generator: `src/components/PasswordGenerator/PasswordGen.tsx`
  - Secret generator: `src/components/SecretGenerator/SecretGen.tsx`
  - Reusable confirm modal: `src/components/UI/ConfirmModal.tsx`
- Backend source (Tauri): `src-tauri/src/`
  - Commands: `src-tauri/src/commands/`
  - Database schema & migrations: `src-tauri/src/database/schema.rs`
  - Main: `src-tauri/src/main.rs`

## Contributing

- Open an issue or submit a pull request. Keep changes focused and add tests where appropriate.

## License
