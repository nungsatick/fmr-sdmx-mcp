---
name: fmr-data-transform
description: Use when validating or converting CSV, XLSX, SDMX-CSV, SDMX-JSON, or SDMX-ML data through the Thailand NSO Fusion Metadata Registry.
---

# Transform data with NSO FMR

1. Call `fmr_health` before the first operation in a task.
2. Use `fmr_list_dataflows` to identify the authoritative target structure. Do not guess an agency, dataflow, DSD, version, dimension, or code.
3. If needed, call `fmr_get_structure` to inspect the selected Dataflow, DSD, Codelist, or Concept Scheme.
4. Prefer `fmr_transform_data` for a complete upload, validation, and conversion workflow.
5. For diagnosis or manual control, use `fmr_load_data`, `fmr_get_validation_status`, `fmr_revalidate`, and `fmr_download` separately.
6. Treat blank observations as missing, never as zero. Never generate statistical observations.
7. Report all validation errors and warnings before presenting a converted file as usable.
8. A successful conversion does not authorize publication. This plugin intentionally has no publish tool.

For non-SDMX CSV/XLSX input, provide a verified Dataflow, DSD, or Provision Agreement URN as `structure_ref`. Arbitrary presentation spreadsheets may need a separate, reviewable preprocessing step before FMR can read them.
