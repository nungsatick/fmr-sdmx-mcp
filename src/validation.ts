/* Interpretation and compaction of FMR validation reports
 * (`/ws/public/data/loadStatus`). A large file can produce thousands of
 * errors; the summary groups them so a model can reason about them without
 * receiving the whole report. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;

export const IN_PROGRESS_STATUSES = ["Initialising", "Analysing", "Validating", "Consolidating"] as const;
export const TERMINAL_STATUSES = ["Complete", "IncorrectDSD", "InvalidRef", "MissingDSD", "Error"] as const;
/** Terminal statuses that can be fixed by attaching a verified structure reference. */
export const STRUCTURE_STATUSES = new Set(["MissingDSD", "IncorrectDSD", "InvalidRef"]);

const terminal = new Set<string>(TERMINAL_STATUSES);

export function isTerminalStatus(status: unknown): boolean {
  return typeof status === "string" && terminal.has(status);
}

/**
 * FMR answers loadStatus for an unknown or expired uid with HTTP 200 and
 * `{"Error":["No Dataset details found for UID: ..."],"Status":500}`.
 * Returns the error text for such an envelope, else undefined.
 */
export function errorEnvelope(report: J): string | undefined {
  if (!report || typeof report !== "object") return "FMR returned an empty validation report.";
  const knownStatus = typeof report.Status === "string"
    && (terminal.has(report.Status) || (IN_PROGRESS_STATUSES as readonly string[]).includes(report.Status));
  if (knownStatus) return undefined;
  const error = report.Error ?? report.error ?? report.message;
  if (error !== undefined) return Array.isArray(error) ? error.join("; ") : String(error);
  if (typeof report.Status === "number") return `FMR returned status ${report.Status}.`;
  return undefined;
}

export const STATUS_HINTS: Record<string, string> = {
  Complete: "Validation finished. Check Errors and PreventsConversion before using the output.",
  MissingDSD: "The file does not say which structure it follows. Pass a verified Dataflow/DSD/Provision Agreement URN (from fmr_list_dataflows or fmr_describe_dataflow) as structure_refs, one per dataset in the file.",
  IncorrectDSD: "The referenced structure cannot validate this data (columns or dimensions do not match). Check the dataflow with fmr_describe_dataflow and fix the file or the structure_refs.",
  InvalidRef: "A referenced Dataflow/DSD/Provision Agreement does not exist in this FMR. Use a URN returned by fmr_list_dataflows.",
  Error: "FMR could not read the file. Check the format (SDMX-CSV, SDMX-ML, SDMX-JSON, EDI, or FMR's own Excel layout) and the encoding (UTF-8).",
};

export interface IssueGroup {
  type: string;
  componentId?: string;
  count: number;
  positions: Record<string, number>;
  topValues: { value: string; count: number }[];
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

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function summarizeDataset(dataset: J, index: number, options: Required<SummaryOptions>): DatasetSummary {
  const groups = new Map<string, {
    type: string; componentId?: string; count: number; positions: Map<string, number>;
    values: Map<string, number>; messages: string[]; keys: string[];
  }>();
  let errorCount = 0;
  const reports = Array.isArray(dataset?.ValidationReport) ? dataset.ValidationReport : [];
  for (const report of reports) {
    const type = String(report?.Type ?? "Unknown");
    const errors = Array.isArray(report?.Errors) ? report.Errors : [];
    for (const error of errors) {
      errorCount += 1;
      const componentId = error?.ComponentId ? String(error.ComponentId) : undefined;
      const groupKey = `${type}|${componentId ?? ""}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = { type, componentId, count: 0, positions: new Map(), values: new Map(), messages: [], keys: [] };
        groups.set(groupKey, group);
      }
      group.count += 1;
      if (error?.Position) increment(group.positions, String(error.Position));
      if (error?.ReportedValue !== undefined && error?.ReportedValue !== null) increment(group.values, String(error.ReportedValue));
      const message = error?.Message ? String(error.Message) : undefined;
      if (message && group.messages.length < options.maxSamples && !group.messages.includes(message)) group.messages.push(message);
      for (const key of Array.isArray(error?.Keys) ? error.Keys : []) {
        if (group.keys.length >= options.maxSamples) break;
        group.keys.push(String(key));
      }
    }
  }
  const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
  return {
    index,
    dataflow: dataset?.Dataflow,
    dsd: dataset?.DSD,
    provisionAgreement: dataset?.ProvisionAgreement,
    dataProvider: dataset?.DataProvider,
    keys: dataset?.KeysCount,
    observations: dataset?.ObsCount ?? dataset?.ObservationsCount,
    groups: dataset?.GroupsCount,
    reportedPeriods: dataset?.ReportedPeriods,
    hasErrors: dataset?.Errors === true || errorCount > 0,
    errorCount,
    issueGroups: sorted.slice(0, options.maxGroups).map((group) => ({
      type: group.type,
      componentId: group.componentId,
      count: group.count,
      positions: Object.fromEntries(group.positions),
      topValues: [...group.values.entries()].sort((a, b) => b[1] - a[1]).slice(0, options.maxValues)
        .map(([value, count]) => ({ value, count })),
      distinctValues: group.values.size,
      sampleMessages: group.messages,
      sampleKeys: group.keys,
    })),
    omittedIssueGroups: Math.max(0, sorted.length - options.maxGroups),
  };
}

export function summarizeValidation(report: J, options: SummaryOptions = {}): ValidationSummary {
  const resolved: Required<SummaryOptions> = {
    maxGroups: options.maxGroups ?? 25,
    maxSamples: options.maxSamples ?? 3,
    maxValues: options.maxValues ?? 10,
  };
  const envelope = errorEnvelope(report);
  const status = typeof report?.Status === "string" ? report.Status : "Error";
  const datasets = (Array.isArray(report?.Datasets) ? report.Datasets : []).map((dataset: J, index: number) => summarizeDataset(dataset, index, resolved));
  const totalErrors = datasets.reduce((sum: number, dataset: DatasetSummary) => sum + dataset.errorCount, 0);
  const hasErrors = report?.Errors === true || totalErrors > 0 || status === "Error";
  const preventsConversion = typeof report?.PreventsConversion === "boolean" ? report.PreventsConversion : undefined;

  let verdict: ValidationSummary["verdict"];
  if (!isTerminalStatus(status) && !envelope) verdict = "in_progress";
  else if (status === "Error" || envelope) verdict = "unreadable";
  else if (STRUCTURE_STATUSES.has(status)) verdict = "structure_problem";
  else if (preventsConversion) verdict = "blocked";
  else if (hasErrors) verdict = "has_errors_but_convertible";
  else verdict = "clean";

  return {
    status,
    hint: STATUS_HINTS[status],
    verdict,
    hasErrors,
    totalErrors,
    preventsConversion,
    preventsPublication: typeof report?.PreventsPublication === "boolean" ? report.PreventsPublication : undefined,
    fileFormat: report?.FileFormat,
    error: envelope ?? (report?.Error !== undefined ? String(report.Error) : undefined),
    datasets,
  };
}
