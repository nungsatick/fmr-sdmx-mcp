import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { clientFromEnvironment, OUTPUT_FORMATS } from "./fmr-client.js";

const client = clientFromEnvironment();
const server = new McpServer({ name: "fmr-sdmx-mcp", version: "0.1.0" });

function response(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

server.registerTool(
  "fmr_health",
  {
    title: "Check NSO FMR",
    description: "Check connectivity to the Thailand NSO FMR public SDMX REST endpoint.",
    inputSchema: {},
  },
  async () => {
    try { return response(await client.health()); } catch (error) { return failure(error); }
  },
);

server.registerTool(
  "fmr_list_dataflows",
  {
    title: "List FMR dataflows",
    description: "Find authoritative dataflows in the NSO Fusion Metadata Registry. Use this before selecting a transformation target.",
    inputSchema: {
      agency: z.string().optional().describe("Agency id, or omit for all agencies."),
      search: z.string().optional().describe("Case-insensitive text matched against id, agency, name, and description."),
      limit: z.number().int().min(1).max(200).default(20),
    },
  },
  async (args) => {
    try { return response(await client.listDataflows(args)); } catch (error) { return failure(error); }
  },
);

server.registerTool(
  "fmr_get_structure",
  {
    title: "Get FMR structure",
    description: "Retrieve an SDMX structural metadata artefact from FMR. Supported resources include dataflow, datastructure, codelist, conceptscheme, contentconstraint, provisionagreement, and structure.",
    inputSchema: {
      resource: z.enum(["dataflow", "datastructure", "codelist", "conceptscheme", "contentconstraint", "provisionagreement", "structure"]),
      agency: z.string().min(1),
      id: z.string().min(1),
      version: z.string().default("latest"),
      references: z.enum(["none", "parents", "parentsandsiblings", "children", "descendants", "all"]).default("none"),
      max_chars: z.number().int().min(1000).max(200000).default(50000),
    },
  },
  async (args) => {
    try {
      return response(await client.getStructure({
        resource: args.resource,
        agency: args.agency,
        id: args.id,
        version: args.version,
        references: args.references,
        maxChars: args.max_chars,
      }));
    } catch (error) { return failure(error); }
  },
);

server.registerTool(
  "fmr_load_data",
  {
    title: "Upload data to FMR validator",
    description: "Upload a supported local CSV, XLSX, XML, JSON, EDI, or ZIP dataset for temporary asynchronous validation. This does not publish data.",
    inputSchema: { file_path: z.string().min(1).describe("Absolute path under FMR_ALLOWED_ROOTS.") },
  },
  async ({ file_path }) => {
    try { return response(await client.loadData(file_path)); } catch (error) { return failure(error); }
  },
);

server.registerTool(
  "fmr_get_validation_status",
  {
    title: "Get FMR validation status",
    description: "Get the validation report for a temporary FMR dataset uid.",
    inputSchema: { uid: z.string().min(1) },
  },
  async ({ uid }) => {
    try { return response(await client.getValidationStatus(uid)); } catch (error) { return failure(error); }
  },
);

server.registerTool(
  "fmr_revalidate",
  {
    title: "Attach structure and revalidate",
    description: "Revalidate a loaded dataset against verified Dataflow, DSD, or Provision Agreement URNs. URNs must come from FMR, not model inference.",
    inputSchema: {
      uid: z.string().min(1),
      structure_refs: z.array(z.string().startsWith("urn:sdmx:")).min(1),
    },
  },
  async ({ uid, structure_refs }) => {
    try { return response(await client.revalidate(uid, structure_refs)); } catch (error) { return failure(error); }
  },
);

server.registerTool(
  "fmr_download",
  {
    title: "Download converted SDMX data",
    description: "Download a validated temporary dataset in a selected SDMX format. This does not publish data.",
    inputSchema: {
      uid: z.string().min(1),
      output_format: z.enum(Object.keys(OUTPUT_FORMATS) as [keyof typeof OUTPUT_FORMATS, ...(keyof typeof OUTPUT_FORMATS)[]]),
      output_path: z.string().min(1).describe("Absolute output path under FMR_ALLOWED_ROOTS."),
      dataset_index: z.number().int().min(0).default(0),
      map_urn: z.string().startsWith("urn:sdmx:").optional().describe("Optional target structure-map URN already stored in FMR."),
      include_metrics: z.boolean().default(false),
      include_unmapped: z.boolean().default(false),
      zip: z.boolean().default(false),
    },
  },
  async (args) => {
    try {
      return response(await client.download({
        uid: args.uid,
        outputFormat: args.output_format,
        outputPath: args.output_path,
        datasetIndex: args.dataset_index,
        mapUrn: args.map_urn,
        includeMetrics: args.include_metrics,
        unmapped: args.include_unmapped,
        zip: args.zip,
      }));
    } catch (error) { return failure(error); }
  },
);

server.registerTool(
  "fmr_transform_data",
  {
    title: "Validate and transform data",
    description: "Run the safe end-to-end workflow: upload, validate, optionally attach a verified structure reference, and download converted SDMX data. No publication occurs.",
    inputSchema: {
      input_path: z.string().min(1).describe("Absolute input path under FMR_ALLOWED_ROOTS."),
      output_path: z.string().min(1).describe("Absolute output path under FMR_ALLOWED_ROOTS."),
      output_format: z.enum(Object.keys(OUTPUT_FORMATS) as [keyof typeof OUTPUT_FORMATS, ...(keyof typeof OUTPUT_FORMATS)[]]),
      structure_ref: z.string().startsWith("urn:sdmx:").optional().describe("Verified Dataflow, DSD, or Provision Agreement URN used when the file does not identify a structure."),
      timeout_seconds: z.number().int().min(10).max(600).default(120),
      dataset_index: z.number().int().min(0).default(0),
    },
  },
  async (args) => {
    try {
      return response(await client.transformData({
        inputPath: args.input_path,
        outputPath: args.output_path,
        outputFormat: args.output_format,
        structureRef: args.structure_ref,
        timeoutSeconds: args.timeout_seconds,
        datasetIndex: args.dataset_index,
      }));
    } catch (error) { return failure(error); }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`fmr-sdmx-mcp connected to ${client.baseUrl}`);
