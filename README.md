# fmr-sdmx-mcp

Local MCP server for the Thailand NSO Fusion Metadata Registry (FMR):

- FMR UI: `https://fmr-sdmx.nso.go.th/fmr/`
- SDMX v2 structure API (used for discovery): `https://fmr-sdmx.nso.go.th/fmr/sdmx/v2/structure`
- SDMX v1 REST API (raw XML): `https://fmr-sdmx.nso.go.th/fmr/ws/public/sdmxapi/rest`
- Asynchronous validation API: `https://fmr-sdmx.nso.go.th/fmr/ws/public/data`

It finds dataflows, explains their structure, maps labels to codes, builds SDMX-CSV templates, validates files and downloads converted SDMX output. It deliberately has **no publish tool** and never changes structural metadata.

Background on FMR: [docs/FMR_KNOWLEDGE.md](docs/FMR_KNOWLEDGE.md).

## Requirements

- Node.js 20.18.1 or newer
- Network access to `fmr-sdmx.nso.go.th` (directly or through a proxy)

## Build, test and run

```powershell
npm install
npm test        # builds, then runs unit tests and a mock-FMR integration test
npm start
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
