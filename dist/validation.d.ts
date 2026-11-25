type J = any;
export declare const IN_PROGRESS_STATUSES: readonly ["Initialising", "Analysing", "Validating", "Consolidating"];
export declare const TERMINAL_STATUSES: readonly ["Complete", "IncorrectDSD", "InvalidRef", "MissingDSD", "Error"];
/** Terminal statuses that can be fixed by attaching a verified structure reference. */
export declare const STRUCTURE_STATUSES: Set<string>;
export declare function isTerminalStatus(status: unknown): boolean;
/**
 * FMR answers loadStatus for an unknown or expired uid with HTTP 200 and
 * `{"Error":["No Dataset details found for UID: ..."],"Status":500}`.
 * Returns the error text for such an envelope, else undefined.
 */
export declare function errorEnvelope(report: J): string | undefined;
export declare const STATUS_HINTS: Record<string, string>;
export interface IssueGroup {
    type: string;
    componentId?: string;
    count: number;
    positions: Record<string, number>;
    topValues: {
        value: string;
        count: number;
    }[];
    distinctValues: number;
    sampleMessages: string[];
    sampleKeys: string[];
}
export interface DatasetSummary {
    index: number;
    dataflow?: string;
    dsd?: string;
    provisionAgreement?: string;
    dataProvider?: string;
    keys?: number;
    observations?: number;
    groups?: number;
    reportedPeriods?: unknown;
    hasErrors: boolean;
    errorCount: number;
    issueGroups: IssueGroup[];
    omittedIssueGroups: number;
}
export interface ValidationSummary {
    status: string;
    hint?: string;
    verdict: "in_progress" | "clean" | "has_errors_but_convertible" | "blocked" | "structure_problem" | "unreadable";
    hasErrors: boolean;
    totalErrors: number;
    preventsConversion?: boolean;
    preventsPublication?: boolean;
    fileFormat?: string;
    error?: string;
    datasets: DatasetSummary[];
}
export interface SummaryOptions {
    maxGroups?: number;
    maxSamples?: number;
    maxValues?: number;
}
export declare function summarizeValidation(report: J, options?: SummaryOptions): ValidationSummary;
export {};
