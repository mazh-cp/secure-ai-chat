# Data Storage and Clean Local Reinstall

## Data layout

- **`./data/uploads/`** — Uploaded file bytes (one `.dat` file per file ID). Configurable via `UPLOADS_DIR`.
- **`./data/app.db`** — SQLite registry (file metadata, `deleted_at`). Configurable via `REGISTRY_DB_PATH` or `DATA_DIR`.

The app uses this for:

- **POST /api/files/store** — Writes file bytes to `./data/uploads`, inserts a row in the registry, and indexes for RAG (same file path/key).
- **GET /api/files/list** — Reads from the registry; excludes rows with `deleted_at` set.
- **DELETE /api/files/:id** (or **DELETE /api/files/delete?fileId=...**) — Sets `deleted_at`, removes the file from `./data/uploads`, and removes RAG embeddings/chunks for that `file_id`.
- **Chat RAG** — Uses the registry to confirm files exist and reads content from `./data/uploads` via the stored key.

## Clean local reinstall steps

1. **Stop the app**  
   Stop any running dev or production server (e.g. `Ctrl+C` or kill the process on port 3000).

2. **Remove build and dependencies (optional)**

   ```bash
   rm -rf node_modules .next
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Type-check and build**

   ```bash
   npm run type-check
   npm run build
   ```

5. **Data directory (optional)**
   - To start with **no** uploaded files or registry:
     ```bash
     rm -rf ./data
     ```
   - To **keep** uploads and registry across reinstall, do **not** delete `./data`.

6. **Start the app**

   ```bash
   npm run start
   ```

   `npm run start` runs the server with **absolute data paths** (`REGISTRY_DB_PATH` and `UPLOADS_DIR`) set from the project root so file list and chat RAG use the same data. For raw Next.js start without this, use `npm run start:next`.  
   For development: `npm run dev`.

7. **Validate**
   - Run smoke tests:
     ```bash
     bash scripts/smoke-test.sh
     bash scripts/smoke-rag-pipeline.sh
     ```
   - Or manually: open the app, upload a file, list files, ask a question in chat (RAG), then delete the file and confirm it disappears from the list and is no longer used in chat.

## Restart server and persistence

After a **server restart** (without deleting `./data`):

- **GET /api/files/list** still returns the same files (from the registry).
- **Chat** still has access to file content (reads from `./data/uploads` using the registry’s storage key).

So: upload → list → chat retrieval; restart server → list and chat still work; delete → file removed from list and not retrievable in chat.

## Production deployment (file list and chat RAG)

For **file list** and **chat RAG** to work reliably:

- **Single process:** Run `npm run start` from the project root. It sets `REGISTRY_DB_PATH` and `UPLOADS_DIR` to absolute paths so list, store, and chat use the same DB and uploads directory.
- **Multiple processes** (e.g. load balancer, PM2 cluster, multiple containers): Set the **same** absolute paths for every process:
  ```bash
  export REGISTRY_DB_PATH="/absolute/path/to/your/data/app.db"
  export UPLOADS_DIR="/absolute/path/to/your/data/uploads"
  npm run start:next
  ```
  If each process uses a different path or default `process.cwd()`, the registry and uploads can be out of sync and RAG will not see uploaded files.

In production, if these env vars are not set, the server logs a one-time warning.

## Build and npm warnings (stability)

- **REGISTRY_DB_PATH / UPLOADS_DIR:** `npm run build` runs `scripts/build-with-data-paths.js`, which sets these to absolute paths before building, so you no longer see the production warning during build.
- **PORT:** Default 3000 is used when `PORT` is unset; the app no longer warns for that.
- **"npm warn Unknown env config devdir":** This comes from your **user** npm config (e.g. `~/.npmrc` or env `npm_config_devdir`), not from this project. npm does not define `devdir`; it is often left over from another tool or an old npm/custom config. In npm’s next major version, unknown config keys may cause failures, so removing it is recommended. To remove it permanently, run:
  ```bash
  npm config delete devdir
  ```
  (This only changes your user npm config; the project does not set `devdir`.)

## Environment variables

| Variable           | Default          | Description                        |
| ------------------ | ---------------- | ---------------------------------- |
| `UPLOADS_DIR`      | `./data/uploads` | Directory for uploaded file bytes. |
| `DATA_DIR`         | `./data`         | Parent directory for DB path.      |
| `REGISTRY_DB_PATH` | `./data/app.db`  | SQLite registry database path.     |

## Smoke script: RAG pipeline

`scripts/smoke-rag-pipeline.sh` checks:

1. Health
2. Upload file
3. List (uploaded file present)
4. Chat with RAG (answer uses file content)
5. Delete file
6. List (file gone)
7. Chat (no file context)

Run with the server already up (start the server **after** `npm run build` so it uses the new storage/registry).

**Note:** `npm run start` sets absolute data paths by default. If using `npm run start:next`, set env vars below first. Start the server with absolute data paths so store and list use the same DB (avoids “list returns 0 after upload” in some setups):

```bash
# From project root; free port 3000 first if needed
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 2

export REGISTRY_DB_PATH="$(pwd)/data/app.db"
export UPLOADS_DIR="$(pwd)/data/uploads"
npm run start:next
```

Then in another terminal:

```bash
BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh
BASE_URL=http://localhost:3000 bash scripts/smoke-rag-pipeline.sh
```

**One-shot reinstall and validate** (clean, install, build, start with absolute paths, run both smoke tests):

```bash
bash scripts/reinstall-and-validate.sh
```

Ensure no other server is using port 3000 before running the script.
