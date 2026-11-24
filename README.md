# fmr-sdmx-mcp

Local MCP server for the Thailand NSO Fusion Metadata Registry:

- FMR UI: `https://fmr-sdmx.nso.go.th/fmr/`
- Public SDMX REST API: `https://fmr-sdmx.nso.go.th/fmr/ws/public/sdmxapi/rest`
- Asynchronous validation API: `https://fmr-sdmx.nso.go.th/fmr/ws/public/data`

The server can discover structural metadata, upload supported datasets, poll validation status, attach a verified structure reference when required, and download converted SDMX output. It deliberately does not expose FMR publication or structural-metadata mutation operations.

## Requirements

- Node.js 20 or newer
- Network access to `fmr-sdmx.nso.go.th`

## Build and run

```powershell
npm install
npm run build
npm start
```

The plugin's `mcp.json` runs `dist/index.js` over stdio.

## Configuration

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `FMR_BASE_URL` | `https://fmr-sdmx.nso.go.th/fmr` | FMR application base URL |
| `FMR_ALLOWED_ROOTS` | plugin working directory | Semicolon-separated absolute directories that tools may read from or write to |
| `FMR_MAX_FILE_MB` | `100` | Maximum upload size |
| `FMR_USERNAME` | unset | Optional HTTP Basic username if validation is restricted |
| `FMR_PASSWORD` | unset | Optional HTTP Basic password |

Set `FMR_ALLOWED_ROOTS` to the working-data directory before asking the MCP to read or write files outside this plugin directory. Credentials must be supplied through the host environment and must never be committed.

Example:

```powershell
$env:FMR_ALLOWED_ROOTS = 'C:\data\sdmx;C:\outputs\sdmx'
npm start
```

## Tools

- `fmr_health`
- `fmr_list_dataflows`
- `fmr_get_structure`
- `fmr_load_data`
- `fmr_get_validation_status`
- `fmr_revalidate`
- `fmr_download`
- `fmr_transform_data`

## Important behavior

- FMR asynchronous tokens are temporary and normally expire after about 15 minutes of inactivity.
- The MCP keeps the FMR session cookie in memory so subsequent status and download calls reach the same server session.
- Input must be a format FMR can read. A visually arranged spreadsheet is not automatically a valid FMR Excel dataset.
- `structure_ref` must be a verified SDMX URN, not a model-generated guess.
- Validation and conversion do not publish data.
