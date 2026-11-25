# fmr-sdmx-mcp

**English** | [ภาษาไทย](README.th.md)

Local MCP server for the Thailand NSO Fusion Metadata Registry (FMR):

- FMR UI: `https://fmr-sdmx.nso.go.th/fmr/`
- SDMX v2 structure API (used for discovery): `https://fmr-sdmx.nso.go.th/fmr/sdmx/v2/structure`
- SDMX v1 REST API (raw XML): `https://fmr-sdmx.nso.go.th/fmr/ws/public/sdmxapi/rest`
- Asynchronous validation API: `https://fmr-sdmx.nso.go.th/fmr/ws/public/data`

It finds dataflows, explains their structure, maps labels to codes, builds SDMX-CSV templates, validates files and downloads converted SDMX output. It deliberately has **no publish tool** and never changes structural metadata.

Background on FMR: [docs/FMR_KNOWLEDGE.md](docs/FMR_KNOWLEDGE.md).

## Installation

Follow these steps to install the server on your own computer. It runs locally and is started by your AI client (Claude Desktop, Claude Code, Codex, Antigravity or another MCP client). Nothing is installed on the FMR server.

### 1. Check the requirements

- **Node.js 20.18.1 or newer.** Check it with `node --version`. If Node.js is missing or older, install the LTS version from <https://nodejs.org>, or on Windows run:

  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```

  Close and reopen the terminal afterwards so `node` and `npm` are found.
- **Network access to `fmr-sdmx.nso.go.th`**, either directly or through a proxy (see `HTTPS_PROXY` under [Configuration](#configuration)).
- **At least one MCP client**: Claude Desktop, Claude Code, OpenAI Codex or Google Antigravity.
- **Git** (optional). It makes updates easier; you can download a ZIP instead.

### 2. Get the code

Put it in a permanent folder, because the client runs it from there. A folder without spaces or Thai characters avoids quoting problems.

```powershell
cd C:\tools          # or any folder you prefer
git clone https://github.com/nungsatick/fmr-sdmx-mcp.git
cd fmr-sdmx-mcp
```

Without Git: open the repository on GitHub, choose **Code → Download ZIP**, extract it (for example to `C:\tools\fmr-sdmx-mcp`), and `cd` into that folder.

### 3. Install dependencies and build

```powershell
npm install
npm run build
```

`npm install` is always needed because `node_modules` is not part of the repository. `npm run build` compiles `src/` into `dist/`; `dist/index.js` is the file the clients run.

### 4. Test it (optional, recommended)

```powershell
npm test
```

All tests should pass. They use a mock FMR and do not need the network. To check the real connection, start the server by hand:

```powershell
node dist/index.js
```

It should print `fmr-sdmx-mcp 0.2.0 connected to https://fmr-sdmx.nso.go.th/fmr` and then wait for a client. Press `Ctrl+C` to stop it.

### 5. Note two paths

- **Server path**: the full path to `dist\index.js`. Print it with:

  ```powershell
  (Resolve-Path dist\index.js).Path
  ```

- **Data folders**: the folder(s) holding the files you will validate or convert, for example `C:\data\sdmx`. These become `FMR_ALLOWED_ROOTS`. The tools cannot read or write anywhere else.

### 6. Add the server to your AI client

Follow the section for your client under [Install in an MCP client](#install-in-an-mcp-client), using the two paths from step 5.

### 7. Check that it works

Restart the client, open a new chat or session and ask:

> Run fmr_health

The answer should show `"ok": true` for both `structureApi` and `dataApi`, and your data folder under `allowedRoots`. Then try, for example, *"Find FMR dataflows about ผู้สูงอายุ"*.

### Updating

```powershell
cd C:\tools\fmr-sdmx-mcp
git pull            # or download and extract the new ZIP over the old folder
npm install
npm run build
```

Restart your client afterwards. The client configuration does not change.

### Uninstalling

Remove the `fmr-sdmx-mcp` entry from your client (see its section below), restart the client, then delete the folder.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `node` is not recognized | Install Node.js (step 1), reopen the terminal, or put the full path to `node.exe` in the client configuration |
| The client shows the server as failed or the tools never appear | Check the path to `dist/index.js` (in JSON every `\` must be `\\`), make sure `npm run build` succeeded, and fully restart the client |
| `fmr_health` shows `ok: false` or a timeout | Open `https://fmr-sdmx.nso.go.th/fmr/` in a browser. On an office network, set `HTTPS_PROXY` in the client's `env` |
| "Path is outside FMR_ALLOWED_ROOTS" | Add that folder to `FMR_ALLOWED_ROOTS` (separate several folders with `;`) and restart the client |
| "FMR has no dataset for uid …" | The FMR upload expired after about 15 minutes. Validate the file again |

## Development

```powershell
npm install
npm test        # builds, then runs unit tests and a mock-FMR integration test
npm start       # runs the server on stdio (normally a client starts it)
```

The plugin's `mcp.json` runs `dist/index.js` over stdio.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FMR_BASE_URL` | `https://fmr-sdmx.nso.go.th/fmr` | FMR application base URL |
| `FMR_ALLOWED_ROOTS` | plugin working directory | Semicolon-separated absolute folders tools may read or write |
| `FMR_MAX_FILE_MB` | `100` | Largest upload |
| `FMR_TIMEOUT_SECONDS` | `60` | Timeout of one ordinary request |
| `FMR_UPLOAD_TIMEOUT_SECONDS` | `300` | Timeout of upload and download requests |
| `FMR_RETRIES` | `2` | Retries for GET requests on network errors, 429, 502, 503, 504 |
| `FMR_CACHE_TTL_SECONDS` | `600` | How long dataflows, structures and codelists are cached (0 = off) |
| `FMR_SESSION_TTL_MINUTES` | `15` | FMR's inactivity expiry for uploads (used in messages) |
| `FMR_LANGUAGE` | `th` | Preferred language for names (falls back to en, then any) |
| `FMR_PROXY` | unset | Explicit proxy URL. Otherwise `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` are honoured |
| `FMR_MAX_RESPONSE_CHARS` | `60000` | Largest tool response returned to the model |
| `FMR_USERNAME` / `FMR_PASSWORD` | unset | Optional HTTP Basic credentials (set both) |

Set `FMR_ALLOWED_ROOTS` to the working-data folders before using local files. Credentials must come from the host environment and must never be committed.

```powershell
$env:FMR_ALLOWED_ROOTS = 'C:\data\sdmx;C:\outputs\sdmx'
$env:HTTPS_PROXY = 'http://proxy.example.go.th:8080'   # only if the network needs it
npm start
```

## Install in an MCP client

The server is a local stdio program: every client starts `node <folder>/dist/index.js` and passes settings as environment variables. Complete [Installation](#installation) steps 1–5 first.

In the examples below, replace:

- `C:\path\to\fmr-sdmx-mcp` with the folder you installed into (step 2). In JSON, write each `\` as `\\`, or use `/`.
- `C:\data\sdmx` with the folders holding your data (`FMR_ALLOWED_ROOTS`, separated by `;`). Tools cannot read or write files anywhere else.

Use the same server name, `fmr-sdmx-mcp`, in every client. After changing a client's configuration, **restart that client** so it starts the server. Check that it works by asking the client to run `fmr_health`.

> If a client cannot find `node`, use its full path, e.g. `C:\\Program Files\\nodejs\\node.exe` on Windows or the output of `which node` on macOS/Linux.

### Claude Code (CLI, or the Code tab of Claude Desktop)

```powershell
claude mcp add --scope user fmr-sdmx-mcp `
  -e FMR_BASE_URL=https://fmr-sdmx.nso.go.th/fmr `
  -e "FMR_ALLOWED_ROOTS=C:\data\sdmx" `
  -e FMR_LANGUAGE=th `
  -- node "C:\path\to\fmr-sdmx-mcp\dist\index.js"

claude mcp get fmr-sdmx-mcp     # should show: Status: ✔ Connected
```

`--scope user` makes it available in every project (stored in `~/.claude.json`). Use `--scope project` to write a shared `.mcp.json` into one repository instead. Remove it with `claude mcp remove fmr-sdmx-mcp -s user`.

### Claude Desktop (Chat tab)

1. Open **Settings → Developer → Edit Config**. This opens `claude_desktop_config.json`:
   - Windows: usually `%APPDATA%\Claude\claude_desktop_config.json`. Some installs keep it under `%LOCALAPPDATA%\Claude-Data\<profile>\` instead, so open it from the menu.
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Add the server under `mcpServers`, keeping any servers already there:

   ```json
   {
     "mcpServers": {
       "fmr-sdmx-mcp": {
         "command": "node",
         "args": ["C:\\path\\to\\fmr-sdmx-mcp\\dist\\index.js"],
         "env": {
           "FMR_BASE_URL": "https://fmr-sdmx.nso.go.th/fmr",
           "FMR_ALLOWED_ROOTS": "C:\\data\\sdmx",
           "FMR_LANGUAGE": "th"
         }
       }
     }
   }
   ```

3. Quit Claude Desktop completely (tray icon → **Quit**; closing the window is not enough), then open it again. The tools appear under the tools/connectors menu of a new chat.

[claude_desktop_config.snippet.json](claude_desktop_config.snippet.json) is a ready-made example to copy from. Back up the file before editing: a JSON syntax error stops every server in it from loading.

### OpenAI Codex (CLI, IDE extension, desktop app)

All Codex clients read `~/.codex/config.toml` (Windows: `%USERPROFILE%\.codex\config.toml`). Add the server with the CLI:

```powershell
codex mcp add fmr-sdmx-mcp `
  --env FMR_BASE_URL=https://fmr-sdmx.nso.go.th/fmr `
  --env "FMR_ALLOWED_ROOTS=C:\data\sdmx" `
  --env FMR_LANGUAGE=th `
  -- node "C:\path\to\fmr-sdmx-mcp\dist\index.js"

codex mcp list
```

Or edit `config.toml` yourself. It is **TOML, not JSON**:

```toml
[mcp_servers.fmr-sdmx-mcp]
command = "node"
args = ['C:\path\to\fmr-sdmx-mcp\dist\index.js']
startup_timeout_sec = 30   # optional; the first FMR request can be slow

[mcp_servers.fmr-sdmx-mcp.env]
FMR_BASE_URL = "https://fmr-sdmx.nso.go.th/fmr"
FMR_ALLOWED_ROOTS = 'C:\data\sdmx'
FMR_LANGUAGE = "th"
```

Single-quoted TOML strings keep Windows backslashes as they are. A syntax error in this file breaks both the CLI and the IDE extension. Remove the server with `codex mcp remove fmr-sdmx-mcp`.

### Google Antigravity

1. In the agent side panel, open the **…** menu → **MCP Servers** → **Manage MCP Servers** → **View raw config**. Newer versions also offer **Settings → Customizations** or `/mcp` in the prompt panel. This opens `mcp_config.json`:
   - Recent versions: `~/.gemini/config/mcp_config.json`
   - Earlier versions: `~/.gemini/antigravity/mcp_config.json`
   - Workspace only: `.agents/mcp_config.json`
2. Add the server. The format is the same as Claude Desktop:

   ```json
   {
     "mcpServers": {
       "fmr-sdmx-mcp": {
         "command": "node",
         "args": ["C:\\path\\to\\fmr-sdmx-mcp\\dist\\index.js"],
         "env": {
           "FMR_BASE_URL": "https://fmr-sdmx.nso.go.th/fmr",
           "FMR_ALLOWED_ROOTS": "C:\\data\\sdmx",
           "FMR_LANGUAGE": "th"
         }
       }
     }
   }
   ```

3. Save, then press **Refresh** in Manage MCP Servers, or restart Antigravity. Optional keys: `"disabled": true` to switch the server off, and `"disabledTools": [...]` to hide some tools.

### Other clients

Any MCP client that can start a stdio server works: command `node`, argument `<repo>/dist/index.js`, and the environment variables from [Configuration](#configuration). Set `HTTPS_PROXY` or `FMR_PROXY` in the same `env` block if the network needs a proxy. Never put `FMR_USERNAME` / `FMR_PASSWORD` in a configuration file that is shared or committed.

## Tools

Discovery and preparation (read-only, cached):

| Tool | Purpose |
| --- | --- |
| `fmr_health` | Checks the structure API and the data API; shows proxy, cache and allowed folders |
| `fmr_list_dataflows` | Searches the dataflows in Thai/English, filters by agency or category, returns URNs |
| `fmr_list_categories` | Lists statistical categories (e.g. `CAT_STAT_SECT`) with dataflow counts |
| `fmr_describe_dataflow` | Compact JSON: dimensions in order, codelists (version pinned by the DSD), time dimension, measure, attributes, constraints, SDMX-CSV header |
| `fmr_get_codes` | Searches codes in the exact codelist a dataflow component uses (or any codelist) |
| `fmr_map_codes` | Maps column values (e.g. Thai province names) to codes; uncertain matches go to review; optional review CSV |
| `fmr_csv_template` | SDMX-CSV 2.0 header and column guide; optional header-only CSV |
| `fmr_get_structure` | Raw structural artefact (SDMX-JSON v2 or SDMX-ML 2.1) |

Validation and conversion (temporary; nothing is published):

| Tool | Purpose |
| --- | --- |
| `fmr_validate` | Upload, wait, attach `structure_refs` if needed, return grouped error summary |
| `fmr_transform_data` | `fmr_validate` + download converted file; writes `<output>.validation.json` |
| `fmr_load_data`, `fmr_get_validation_status`, `fmr_revalidate`, `fmr_download` | Manual step-by-step control |

## Important behaviour

- Validation results are **summarised**: errors are grouped by type × component with counts, top reported values and sample keys. The full FMR report is written to a JSON file.
- Verdicts: `clean`, `has_errors_but_convertible`, `blocked` (PreventsConversion), `structure_problem` (MissingDSD/IncorrectDSD/InvalidRef), `unreadable`, `in_progress`.
- FMR uploads expire after about 15 minutes of inactivity. An unknown or expired uid fails immediately with a clear message (FMR answers such uids with HTTP 200 and an error body).
- The MCP keeps the FMR session cookie per uid in memory, so status and download calls reach the same server session.
- `structure_refs` needs one verified URN per dataset in the file. URNs must come from `fmr_list_dataflows` / `fmr_describe_dataflow`, never from guessing.
- Codelists differ between versions (for example the DSD may use `CL_AREA(1.6)` while the latest is `1.8`). `fmr_get_codes` and `fmr_map_codes` use the version the DSD references when a dataflow is given.
- Output files are never overwritten unless `overwrite=true`.
- Blank observations are missing values, never zero. Conversion is not publication.

## Changelog

### 0.2.0
- New tools: `fmr_list_categories`, `fmr_describe_dataflow`, `fmr_get_codes`, `fmr_map_codes`, `fmr_csv_template`, `fmr_validate`.
- Discovery uses the SDMX v2 JSON API with stubs and an in-memory cache (the dataflow list was 1.26 MB of XML per call).
- Request timeouts, retry with backoff for GET requests, and proxy support (`HTTPS_PROXY`, `FMR_PROXY`).
- Grouped validation summaries; full report saved to file.
- Fast failure for unknown/expired uids instead of polling until timeout.
- `structure_refs` (one URN per dataset) and revalidation for `IncorrectDSD` / `InvalidRef` as well as `MissingDSD`.
- File safety: size checked before reading, output folders created, no silent overwrite, extension warnings.
- Thai names preferred, with fallbacks; tool annotations; response size limit.
- Tests run on any OS, including a mock FMR server.
