---
name: fmr-data-transform
description: Use when finding NSO dataflows, preparing statistical tables as SDMX, mapping labels to codes, or validating/converting CSV, XLSX, SDMX-CSV, SDMX-JSON or SDMX-ML data through the Thailand NSO Fusion Metadata Registry.
---

# Prepare, validate and convert data with NSO FMR

## 1. Find the target structure
1. Call `fmr_health` once at the start of a task.
2. Find the dataflow with `fmr_list_dataflows` (search in Thai or English, or filter by `category` from `fmr_list_categories`). Never guess an agency, dataflow, DSD, version, dimension or code.
3. Call `fmr_describe_dataflow` to see the dimensions in order, their codelists, mandatory attributes, constraints and the SDMX-CSV header.

## 2. Prepare the data (for ordinary tables)
4. `fmr_csv_template` gives the SDMX-CSV 2.0 header. A file in this layout names its own structure, so no `structure_refs` are needed.
5. Convert labels to codes with `fmr_map_codes` (one component at a time, pass the column's values). Apply only `matched` results automatically. Show `needs_review`, `ambiguous` and `unmatched` values to the user and wait for confirmation. Use `fmr_get_codes` to look up alternatives.
6. Treat blank observations as missing, never as zero. Never invent or impute observations. Keep the preprocessing step reviewable (write the reshaped file and the mapping CSV to disk).

## 3. Validate and convert
7. Use `fmr_validate` to check a file, or `fmr_transform_data` to validate and convert in one step. For files without STRUCTURE columns, pass `structure_refs` with the dataflow URN(s) from step 2, one per dataset.
8. Read the `summary`: `verdict`, `totalErrors`, and `issueGroups` (type × component with top values). Report every error group to the user before calling a converted file usable. The full report is saved as JSON.
9. If `verdict` is `structure_problem`, follow `hint`. If an uid has expired (~15 min), upload again.
10. A successful conversion does not authorise publication. This plugin has no publish tool.
