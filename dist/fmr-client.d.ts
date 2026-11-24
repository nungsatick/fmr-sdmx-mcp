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
export interface ClientOptions {
    baseUrl?: string;
    allowedRoots?: string[];
    maxFileBytes?: number;
    username?: string;
    password?: string;
}
export interface DataflowSummary {
    agency: string;
    id: string;
    version: string;
    name?: string;
    description?: string;
}
export declare function parseDataflows(xml: string): DataflowSummary[];
export declare function isTerminalStatus(status: unknown): boolean;
export declare class FmrClient {
    readonly baseUrl: string;
    readonly allowedRoots: string[];
    readonly maxFileBytes: number;
    private readonly username?;
    private readonly password?;
    private readonly sessions;
    constructor(options?: ClientOptions);
    private authHeaders;
    private sessionHeaders;
    private rememberSession;
    private assertAllowed;
    private responseError;
    health(): Promise<Record<string, unknown>>;
    listDataflows(options?: {
        agency?: string;
        search?: string;
        limit?: number;
    }): Promise<Record<string, unknown>>;
    getStructure(options: {
        resource: string;
        agency: string;
        id: string;
        version?: string;
        references?: string;
        maxChars?: number;
    }): Promise<Record<string, unknown>>;
    loadData(filePath: string): Promise<Record<string, unknown>>;
    getValidationStatus(uid: string): Promise<Record<string, unknown>>;
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
    }): Promise<Record<string, unknown>>;
    waitForTerminal(uid: string, timeoutSeconds?: number, pollIntervalMs?: number): Promise<Record<string, unknown>>;
    transformData(options: {
        inputPath: string;
        outputPath: string;
        outputFormat: OutputFormat;
        structureRef?: string;
        timeoutSeconds?: number;
        datasetIndex?: number;
    }): Promise<Record<string, unknown>>;
}
export declare function clientFromEnvironment(): FmrClient;
