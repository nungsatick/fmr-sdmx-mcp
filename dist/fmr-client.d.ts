import { type FmrConfig } from "./config.js";
import { HttpClient } from "./http.js";
import { type DataflowDescription } from "./structure.js";
import { type SummaryOptions, type ValidationSummary } from "./validation.js";
export { isTerminalStatus } from "./validation.js";
export declare const OUTPUT_FORMATS: {
    readonly "sdmx-csv-1.0": {
        readonly accept: "application/vnd.sdmx.data+csv;version=1.0.0";
        readonly extension: ".csv";
    };
    readonly "sdmx-csv-2.0": {
        readonly accept: "application/vnd.sdmx.data+csv;version=2.0.0";
        readonly extension: ".csv";
    };
    readonly "sdmx-json-1.0": {
        readonly accept: "application/vnd.sdmx.data+json;version=1.0.0";
        readonly extension: ".json";
    };
    readonly "sdmx-ml-2.1-structure-specific": {
        readonly accept: "application/vnd.sdmx.structurespecificdata+xml;version=2.1";
        readonly extension: ".xml";
    };
    readonly "sdmx-ml-2.1-generic": {
        readonly accept: "application/vnd.sdmx.genericdata+xml;version=2.1";
        readonly extension: ".xml";
    };
};
export type OutputFormat = keyof typeof OUTPUT_FORMATS;
export interface DataflowLookup {
    urn?: string;
    agency?: string;
    id?: string;
    version?: string;
}
type J = any;
export declare class FmrClient {
    readonly config: FmrConfig;
    readonly http: HttpClient;
    private readonly sessions;
    private readonly structures;
    constructor(config?: Partial<FmrConfig> | FmrConfig, http?: HttpClient);
    get baseUrl(): string;
    get allowedRoots(): string[];
    private authHeaders;
    private purgeSessions;
    private sessionHeaders;
    private touch;
    private rememberSession;
    private expiryHint;
    assertAllowed(filePath: string): string;
    private prepareOutput;
    private structureUrl;
    private getStructureJson;
    private static segment;
    private resolveDataflow;
    health(): Promise<Record<string, unknown>>;
    private allDataflows;
    private categorySchemes;
    /**
     * Categorisations are slow to query on the NSO FMR (over 60 s). Load them in
     * the background with a long timeout and wait at most waitMs; callers fall
     * back to the dataflow-id prefix (DF_01... -> 01DEM) meanwhile.
     */
    private categorisations;
    private static prefixIndex;
    private categoryData;
    listDataflows(options?: {
        agency?: string;
        search?: string;
        category?: string;
        limit?: number;
        offset?: number;
    }): Promise<Record<string, unknown>>;
    listCategories(): Promise<Record<string, unknown>>;
    getStructure(options: {
        resource: string;
        agency: string;
        id: string;
        version?: string;
        references?: string;
        detail?: string;
        format?: "json" | "xml";
        maxChars?: number;
    }): Promise<Record<string, unknown>>;
    private dataflowMessage;
    describeDataflow(lookup: DataflowLookup): Promise<DataflowDescription>;
    /** describeDataflow with long allowed-code lists shortened for display. */
    describeDataflowForDisplay(lookup: DataflowLookup, maxAllowedCodes?: number): Promise<DataflowDescription>;
    private codesFor;
    getCodes(options: {
        codelistUrn?: string;
        agency?: string;
        id?: string;
        version?: string;
        dataflow?: DataflowLookup;
        component?: string;
        search?: string;
        parent?: string;
        limit?: number;
        offset?: number;
    }): Promise<Record<string, unknown>>;
    mapCodes(options: {
        dataflow: DataflowLookup;
        component: string;
        values: string[];
        outputPath?: string;
        overwrite?: boolean;
    }): Promise<Record<string, unknown>>;
    csvTemplate(options: {
        dataflow: DataflowLookup;
        outputPath?: string;
        includeOptionalAttributes?: boolean;
        overwrite?: boolean;
    }): Promise<Record<string, unknown>>;
    loadData(filePath: string): Promise<Record<string, unknown>>;
    /** Raw FMR validation report. Throws a clear error for unknown/expired uids. */
    getValidationReport(uid: string): Promise<J>;
    getValidationStatus(uid: string, options?: {
        detail?: "summary" | "full";
        reportPath?: string;
        overwrite?: boolean;
    } & SummaryOptions): Promise<Record<string, unknown>>;
    private writeReport;
    revalidate(uid: string, structureRefs: string[]): Promise<Record<string, unknown>>;
    download(options: {
        uid: string;
        outputFormat: OutputFormat;
        outputPath: string;
        datasetIndex?: number;
        mapUrn?: string;
        zip?: boolean;
        includeMetrics?: boolean;
        unmapped?: boolean;
        overwrite?: boolean;
    }): Promise<Record<string, unknown>>;
    waitForTerminal(uid: string, timeoutSeconds?: number): Promise<J>;
    /** Upload, wait, and revalidate with structure refs when FMR needs them. */
    validateFile(options: {
        inputPath: string;
        structureRefs?: string[];
        timeoutSeconds?: number;
        reportPath?: string;
    } & SummaryOptions): Promise<{
        uid: string;
        load: Record<string, unknown>;
        report: J;
        summary: ValidationSummary;
        revalidated: boolean;
        reportPath?: string;
    }>;
    validateOnly(options: {
        inputPath: string;
        structureRefs?: string[];
        timeoutSeconds?: number;
        reportPath?: string;
    } & SummaryOptions): Promise<Record<string, unknown>>;
    transformData(options: {
        inputPath: string;
        outputPath: string;
        outputFormat: OutputFormat;
        structureRefs?: string[];
        timeoutSeconds?: number;
        datasetIndex?: number;
        overwrite?: boolean;
        reportPath?: string;
    } & SummaryOptions): Promise<Record<string, unknown>>;
}
export declare function clientFromEnvironment(env?: NodeJS.ProcessEnv): FmrClient;
