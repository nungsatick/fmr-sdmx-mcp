import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OUTPUT_FORMATS } from "./fmr-client.js";
export const VERSION = "0.2.0";
const formatEnum = z.enum(Object.keys(OUTPUT_FORMATS));
const urn = z.string().startsWith("urn:sdmx:");
const dataflowShape = {
    dataflow_urn: urn.optional().describe("Dataflow URN from fmr_list_dataflows. Alternatively give agency + dataflow_id."),
    agency: z.string().optional().describe("Agency id; default TNSO."),
    dataflow_id: z.string().optional().describe("Dataflow id, e.g. DF_01DI_IND_AGING."),
    version: z.string().optional().describe("Version; default latest (~)."),
};
function dataflowLookup(args) {
    return { urn: args.dataflow_urn, agency: args.agency, id: args.dataflow_id, version: args.version };
}
const summaryShape = {
    max_issue_groups: z.number().int().min(1).max(200).default(25).describe("Most error groups to return per dataset."),
};
export function createServer(client) {
    const server = new McpServer({ name: "fmr-sdmx-mcp", version: VERSION });
    const maxChars = client.config.maxResponseChars;
    function response(value) {
        const text = JSON.stringify(value, null, 2);
        if (text.length > maxChars) {
            return {
                content: [{
                        type: "text",
                        text: `${text.slice(0, maxChars)}\n... [truncated ${text.length - maxChars} characters; narrow the request with search/limit/offset or write the result to a file]`,
                    }],
            };
        }
        return {
            content: [{ type: "text", text }],
            structuredContent: value,
        };
    }
    function failure(error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: message }], isError: true };
    }
    async function run(action) {
        try {
            return response(await action());
        }
        catch (error) {
            return failure(error);
        }
    }
    const readOnly = { readOnlyHint: true, openWorldHint: true };
    const writesLocal = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
    server.registerTool("fmr_health", {
        title: "Check NSO FMR",
        description: "Check that the NSO FMR structure API and data-validation API are reachable, and show proxy, cache and allowed-folder settings. Call before the first operation in a task.",
        inputSchema: {},
        annotations: readOnly,
    }, async () => run(() => client.health()));
    server.registerTool("fmr_list_dataflows", {
        title: "Find FMR dataflows",
        description: "Search the authoritative dataflows in the NSO FMR (cached). Matches Thai or English names, ids and descriptions; filter by agency or statistical category. Returns URNs to use as structure_refs.",
        inputSchema: {
            search: z.string().optional().describe("Words to match, Thai or English, e.g. 'ผู้สูงอายุ' or 'DF_01DI'. All words must match."),
            category: z.string().optional().describe("Category id or name from fmr_list_categories, e.g. '02LAB' or 'แรงงาน'."),
            agency: z.string().optional().describe("Agency id, e.g. TNSO or IAEG-SDGs."),
            limit: z.number().int().min(1).max(200).default(20),
            offset: z.number().int().min(0).default(0),
        },
        annotations: readOnly,
    }, async (args) => run(() => client.listDataflows(args)));
    server.registerTool("fmr_list_categories", {
        title: "List FMR statistical categories",
        description: "List the statistical subject categories (e.g. CAT_STAT_SECT) with the number of dataflows in each. Use the id with fmr_list_dataflows(category=...).",
        inputSchema: {},
        annotations: readOnly,
    }, async () => run(() => client.listCategories()));
    server.registerTool("fmr_describe_dataflow", {
        title: "Describe a dataflow",
        description: "Return the structure of a dataflow as compact JSON: dimensions in order with their codelists (the exact version the DSD uses), time dimension, measure, mandatory/optional attributes, content constraints, category and the SDMX-CSV 2.0 header. Use this instead of reading raw XML.",
        inputSchema: dataflowShape,
        annotations: readOnly,
    }, async (args) => run(() => client.describeDataflowForDisplay(dataflowLookup(args))));
    server.registerTool("fmr_get_codes", {
        title: "Search codes in a codelist",
        description: "List or search codes (Thai/English names or ids). Give dataflow + component to get exactly the codelist version that dataflow uses (and which codes its constraints allow), or give a codelist URN/id.",
        inputSchema: {
            ...dataflowShape,
            component: z.string().optional().describe("Dimension or attribute id, e.g. AREA, SEX. Needs a dataflow."),
            codelist_urn: urn.optional(),
            codelist_id: z.string().optional().describe("e.g. CL_AREA; with agency and version (default latest)."),
            search: z.string().optional().describe("Text to find, e.g. 'เชียงใหม่' or 'TH5'."),
            parent: z.string().optional().describe("Only children of this code ('' for top level)."),
            limit: z.number().int().min(1).max(500).default(50),
            offset: z.number().int().min(0).default(0),
        },
        annotations: readOnly,
    }, async (args) => run(() => {
        const hasDataflow = Boolean(args.dataflow_urn || args.dataflow_id);
        return client.getCodes({
            dataflow: hasDataflow && args.component ? dataflowLookup(args) : undefined,
            component: args.component,
            codelistUrn: args.codelist_urn,
            agency: args.agency,
            id: args.codelist_id,
            version: hasDataflow ? undefined : args.version,
            search: args.search,
            parent: args.parent,
            limit: args.limit,
            offset: args.offset,
        });
    }));
    server.registerTool("fmr_map_codes", {
        title: "Map labels to codes",
        description: "Match the distinct values of one column (labels such as Thai province names, or codes) to the codelist of a dataflow component. Exact and normalised matches are 'matched'; everything else is returned for human review with candidates. Never apply 'needs_review' or 'ambiguous' results without confirmation.",
        inputSchema: {
            ...dataflowShape,
            component: z.string().min(1).describe("Dimension or attribute id, e.g. AREA."),
            values: z.array(z.string()).min(1).max(20000).describe("Column values; duplicates are fine and are counted."),
            output_path: z.string().optional().describe("Optional absolute path under FMR_ALLOWED_ROOTS for a review CSV (UTF-8 with BOM)."),
            overwrite: z.boolean().default(false),
        },
        annotations: writesLocal,
    }, async (args) => run(() => client.mapCodes({
        dataflow: dataflowLookup(args),
        component: args.component,
        values: args.values,
        outputPath: args.output_path,
        overwrite: args.overwrite,
    })));
    server.registerTool("fmr_csv_template", {
        title: "SDMX-CSV template for a dataflow",
        description: "Build the SDMX-CSV 2.0 header and a column guide for a dataflow, optionally writing a header-only CSV. A file in this layout names its own structure, so FMR can validate it without structure_refs.",
        inputSchema: {
            ...dataflowShape,
            output_path: z.string().optional().describe("Optional absolute .csv path under FMR_ALLOWED_ROOTS."),
            include_optional_attributes: z.boolean().default(false),
            overwrite: z.boolean().default(false),
        },
        annotations: writesLocal,
    }, async (args) => run(() => client.csvTemplate({
        dataflow: dataflowLookup(args),
        outputPath: args.output_path,
        includeOptionalAttributes: args.include_optional_attributes,
        overwrite: args.overwrite,
    })));
    server.registerTool("fmr_get_structure", {
        title: "Get raw FMR structure",
        description: "Retrieve a raw SDMX structural artefact (JSON via the SDMX v2 API by default, or SDMX-ML 2.1 XML). Prefer fmr_describe_dataflow and fmr_get_codes; use this for artefacts they do not cover.",
        inputSchema: {
            resource: z.enum(["dataflow", "datastructure", "codelist", "conceptscheme", "contentconstraint", "provisionagreement", "categoryscheme", "structuremap", "representationmap", "hierarchy", "structure"]),
            agency: z.string().min(1),
            id: z.string().min(1),
            version: z.string().default("~").describe("~ or latest for the latest version."),
            references: z.enum(["none", "parents", "parentsandsiblings", "ancestors", "children", "descendants", "all"]).default("none"),
            detail: z.enum(["full", "allstubs", "referencestubs", "allcompletestubs", "referencecompletestubs", "referencepartial"]).optional(),
            format: z.enum(["json", "xml"]).default("json"),
            max_chars: z.number().int().min(1000).max(200000).default(50000),
        },
        annotations: readOnly,
    }, async (args) => run(() => client.getStructure({ ...args, maxChars: args.max_chars })));
    server.registerTool("fmr_validate", {
        title: "Validate a data file",
        description: "Upload a local file to FMR for temporary validation, wait for the result, attach structure_refs if FMR needs them, and return a grouped error summary. Writes the full report as JSON when report_path is given. Does not convert or publish.",
        inputSchema: {
            input_path: z.string().min(1).describe("Absolute path under FMR_ALLOWED_ROOTS."),
            structure_refs: z.array(urn).optional().describe("Verified Dataflow/DSD/Provision Agreement URNs, one per dataset in the file, in order."),
            report_path: z.string().optional().describe("Optional absolute .json path for the full FMR report."),
            timeout_seconds: z.number().int().min(10).max(1800).default(180),
            ...summaryShape,
        },
        annotations: writesLocal,
    }, async (args) => run(() => client.validateOnly({
        inputPath: args.input_path,
        structureRefs: args.structure_refs,
        reportPath: args.report_path,
        timeoutSeconds: args.timeout_seconds,
        maxGroups: args.max_issue_groups,
    })));
    server.registerTool("fmr_transform_data", {
        title: "Validate and convert data",
        description: "End-to-end: upload, validate, attach structure_refs when FMR reports MissingDSD/IncorrectDSD/InvalidRef, download the converted SDMX file, and save the full validation report next to it (<output>.validation.json). Returns a grouped error summary. No publication occurs.",
        inputSchema: {
            input_path: z.string().min(1).describe("Absolute input path under FMR_ALLOWED_ROOTS."),
            output_path: z.string().min(1).describe("Absolute output path under FMR_ALLOWED_ROOTS."),
            output_format: formatEnum,
            structure_refs: z.array(urn).optional().describe("Verified URNs, one per dataset in the file, in order."),
            structure_ref: urn.optional().describe("Deprecated single-URN form of structure_refs."),
            overwrite: z.boolean().default(false),
            timeout_seconds: z.number().int().min(10).max(1800).default(180),
            dataset_index: z.number().int().min(0).default(0),
            report_path: z.string().optional().describe("Default: <output_path>.validation.json"),
            ...summaryShape,
        },
        annotations: writesLocal,
    }, async (args) => run(() => client.transformData({
        inputPath: args.input_path,
        outputPath: args.output_path,
        outputFormat: args.output_format,
        structureRefs: args.structure_refs ?? (args.structure_ref ? [args.structure_ref] : undefined),
        overwrite: args.overwrite,
        timeoutSeconds: args.timeout_seconds,
        datasetIndex: args.dataset_index,
        reportPath: args.report_path,
        maxGroups: args.max_issue_groups,
    })));
    server.registerTool("fmr_load_data", {
        title: "Upload data to FMR validator",
        description: "Upload a local CSV, XLSX, XML, JSON, EDI or ZIP file for temporary asynchronous validation and return its uid. The uid expires after ~15 minutes of inactivity. Prefer fmr_validate or fmr_transform_data.",
        inputSchema: { file_path: z.string().min(1).describe("Absolute path under FMR_ALLOWED_ROOTS.") },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, async ({ file_path }) => run(() => client.loadData(file_path)));
    server.registerTool("fmr_get_validation_status", {
        title: "Get FMR validation status",
        description: "Get the validation result for a temporary uid as a grouped summary (default) or the full FMR report. Optionally write the full report to a JSON file.",
        inputSchema: {
            uid: z.string().min(1),
            detail: z.enum(["summary", "full"]).default("summary"),
            report_path: z.string().optional().describe("Optional absolute .json path for the full report."),
            ...summaryShape,
        },
        annotations: readOnly,
    }, async ({ uid, detail, report_path, max_issue_groups }) => run(() => client.getValidationStatus(uid, {
        detail, reportPath: report_path, maxGroups: max_issue_groups,
    })));
    server.registerTool("fmr_revalidate", {
        title: "Attach structure and revalidate",
        description: "Revalidate a loaded dataset against verified Dataflow, DSD or Provision Agreement URNs, one per dataset in the file. URNs must come from FMR, never from inference. Then poll fmr_get_validation_status.",
        inputSchema: {
            uid: z.string().min(1),
            structure_refs: z.array(urn).min(1),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    }, async ({ uid, structure_refs }) => run(() => client.revalidate(uid, structure_refs)));
    server.registerTool("fmr_download", {
        title: "Download converted SDMX data",
        description: "Download a validated temporary dataset in a chosen SDMX format to a local file. Does not publish data.",
        inputSchema: {
            uid: z.string().min(1),
            output_format: formatEnum,
            output_path: z.string().min(1).describe("Absolute output path under FMR_ALLOWED_ROOTS."),
            dataset_index: z.number().int().min(0).default(0),
            map_urn: urn.optional().describe("Optional target Dataflow/DSD URN; a Structure Map to it must already exist in FMR."),
            include_metrics: z.boolean().default(false),
            include_unmapped: z.boolean().default(false),
            zip: z.boolean().default(false),
            overwrite: z.boolean().default(false),
        },
        annotations: writesLocal,
    }, async (args) => run(() => client.download({
        uid: args.uid,
        outputFormat: args.output_format,
        outputPath: args.output_path,
        datasetIndex: args.dataset_index,
        mapUrn: args.map_urn,
        includeMetrics: args.include_metrics,
        unmapped: args.include_unmapped,
        zip: args.zip,
        overwrite: args.overwrite,
    })));
    return server;
}
//# sourceMappingURL=server.js.map