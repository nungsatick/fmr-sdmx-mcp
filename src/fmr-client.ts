import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

export const OUTPUT_FORMATS = {
  "sdmx-csv-1.0": {
    accept: "application/vnd.sdmx.data+csv;version=1.0.0",
    extension: ".csv",
  },
  "sdmx-csv-2.0": {
    accept: "application/vnd.sdmx.data+csv;version=2.0.0",
    extension: ".csv",
  },
  "sdmx-json-1.0": {
    accept: "application/vnd.sdmx.data+json;version=1.0.0",
    extension: ".json",
  },
  "sdmx-ml-2.1-structure-specific": {
    accept: "application/vnd.sdmx.structurespecificdata+xml;version=2.1",
    extension: ".xml",
  },
  "sdmx-ml-2.1-generic": {
    accept: "application/vnd.sdmx.genericdata+xml;version=2.1",
    extension: ".xml",
  },
} as const;

export type OutputFormat = keyof typeof OUTPUT_FORMATS;

const terminalStatuses = new Set([
  "Complete",
  "IncorrectDSD",
  "InvalidRef",
  "MissingDSD",
  "Error",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  textNodeName: "#text",
});

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

interface StoredSession {
  cookie?: string;
  createdAt: number;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function localisedText(value: unknown): string | undefined {
  const values = asArray(value as Record<string, unknown> | Record<string, unknown>[] | undefined);
  for (const item of values) {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && typeof item["#text"] === "string") {
      return item["#text"] as string;
    }
  }
  return undefined;
}

function collectByKey(value: unknown, key: string, output: Record<string, unknown>[]): void {
  if (!value || typeof value !== "object") return;
  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    if (childKey === key) {
      for (const item of asArray(childValue as Record<string, unknown> | Record<string, unknown>[])) {
        if (item && typeof item === "object") output.push(item);
      }
    }
    collectByKey(childValue, key, output);
  }
}

export function parseDataflows(xml: string): DataflowSummary[] {
  const document = parser.parse(xml);
  const nodes: Record<string, unknown>[] = [];
  collectByKey(document, "Dataflow", nodes);
  const unique = new Map<string, DataflowSummary>();
  for (const node of nodes) {
    const agency = String(node["@_agencyID"] ?? "");
    const id = String(node["@_id"] ?? "");
    const version = String(node["@_version"] ?? "");
    if (!agency || !id) continue;
    const item: DataflowSummary = {
      agency,
      id,
      version,
      name: localisedText(node.Name),
      description: localisedText(node.Description),
    };
    unique.set(`${agency}:${id}:${version}`, item);
  }
  return [...unique.values()];
}

export function isTerminalStatus(status: unknown): boolean {
  return typeof status === "string" && terminalStatuses.has(status);
}

export class FmrClient {
  readonly baseUrl: string;
  readonly allowedRoots: string[];
  readonly maxFileBytes: number;
  private readonly username?: string;
  private readonly password?: string;
  private readonly sessions = new Map<string, StoredSession>();

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://fmr-sdmx.nso.go.th/fmr").replace(/\/$/, "");
    this.allowedRoots = (options.allowedRoots ?? [process.cwd()]).map((root) => path.resolve(root));
    this.maxFileBytes = options.maxFileBytes ?? 100 * 1024 * 1024;
    this.username = options.username;
    this.password = options.password;
  }

  private authHeaders(): Record<string, string> {
    if (!this.username && !this.password) return {};
    if (!this.username || !this.password) {
      throw new Error("Both FMR_USERNAME and FMR_PASSWORD must be set together.");
    }
    return { Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString("base64")}` };
  }

  private sessionHeaders(uid?: string): Record<string, string> {
    const cookie = uid ? this.sessions.get(uid)?.cookie : undefined;
    return cookie ? { Cookie: cookie } : {};
  }

  private rememberSession(uid: string, response: Response): void {
    const headersWithCookies = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = headersWithCookies.getSetCookie?.() ?? [];
    const cookie = setCookies.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ") || undefined;
    this.sessions.set(uid, { cookie, createdAt: Date.now() });
  }

  private assertAllowed(filePath: string): string {
    const resolved = path.resolve(filePath);
    const allowed = this.allowedRoots.some((root) => {
      const relative = path.relative(root, resolved);
      return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    });
    if (!allowed) {
      throw new Error(`Path is outside FMR_ALLOWED_ROOTS: ${resolved}`);
    }
    return resolved;
  }

  private async responseError(response: Response): Promise<Error> {
    const body = (await response.text()).slice(0, 4000);
    return new Error(`FMR request failed (${response.status} ${response.statusText}): ${body}`);
  }

  async health(): Promise<Record<string, unknown>> {
    const endpoint = `${this.baseUrl}/ws/public/sdmxapi/rest/dataflow/all/all/latest?references=none`;
    const started = Date.now();
    const response = await fetch(endpoint, {
      headers: { Accept: "application/vnd.sdmx.structure+xml;version=2.1", ...this.authHeaders() },
    });
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      elapsedMs: Date.now() - started,
      baseUrl: this.baseUrl,
      endpoint,
    };
  }

  async listDataflows(options: { agency?: string; search?: string; limit?: number } = {}): Promise<Record<string, unknown>> {
    const agency = options.agency || "all";
    const endpoint = `${this.baseUrl}/ws/public/sdmxapi/rest/dataflow/${encodeURIComponent(agency)}/all/latest?references=none`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/vnd.sdmx.structure+xml;version=2.1", ...this.authHeaders() },
    });
    if (!response.ok) throw await this.responseError(response);
    const xml = await response.text();
    const query = options.search?.trim().toLowerCase();
    let items = parseDataflows(xml);
    if (query) {
      items = items.filter((item) => [item.id, item.agency, item.name, item.description]
        .some((value) => value?.toLowerCase().includes(query)));
    }
    const totalMatched = items.length;
    items = items.slice(0, options.limit ?? 20);
    return { endpoint, totalMatched, returned: items.length, dataflows: items };
  }

  async getStructure(options: {
    resource: string;
    agency: string;
    id: string;
    version?: string;
    references?: string;
    maxChars?: number;
  }): Promise<Record<string, unknown>> {
    const endpoint = `${this.baseUrl}/ws/public/sdmxapi/rest/${encodeURIComponent(options.resource)}/${encodeURIComponent(options.agency)}/${encodeURIComponent(options.id)}/${encodeURIComponent(options.version ?? "latest")}?references=${encodeURIComponent(options.references ?? "none")}`;
    const response = await fetch(endpoint, {
      headers: { Accept: "application/vnd.sdmx.structure+xml;version=2.1", ...this.authHeaders() },
    });
    if (!response.ok) throw await this.responseError(response);
    const body = await response.text();
    const maxChars = options.maxChars ?? 50_000;
    return {
      endpoint,
      contentType: response.headers.get("content-type"),
      totalChars: body.length,
      truncated: body.length > maxChars,
      xml: body.slice(0, maxChars),
    };
  }

  async loadData(filePath: string): Promise<Record<string, unknown>> {
    const resolved = this.assertAllowed(filePath);
    const bytes = await readFile(resolved);
    if (bytes.byteLength > this.maxFileBytes) {
      throw new Error(`File exceeds FMR_MAX_FILE_MB limit (${bytes.byteLength} bytes).`);
    }
    const form = new FormData();
    form.append("uploadFile", new Blob([bytes]), path.basename(resolved));
    const response = await fetch(`${this.baseUrl}/ws/public/data/load`, {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
    });
    if (!response.ok) throw await this.responseError(response);
    const result = await response.json() as Record<string, unknown>;
    const uid = String(result.uid ?? result.UID ?? "");
    if (!uid) throw new Error(`FMR did not return a dataset uid: ${JSON.stringify(result)}`);
    this.rememberSession(uid, response);
    return { ...result, uid, filePath: resolved, sizeBytes: bytes.byteLength };
  }

  async getValidationStatus(uid: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/ws/public/data/loadStatus?uid=${encodeURIComponent(uid)}`, {
      headers: { Accept: "application/json", ...this.authHeaders(), ...this.sessionHeaders(uid) },
    });
    if (!response.ok) throw await this.responseError(response);
    return await response.json() as Record<string, unknown>;
  }

  async revalidate(uid: string, structureRefs: string[]): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/ws/public/data/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...this.authHeaders(),
        ...this.sessionHeaders(uid),
      },
      body: JSON.stringify({ UID: uid, SRef: structureRefs }),
    });
    if (!response.ok) throw await this.responseError(response);
    return await response.json() as Record<string, unknown>;
  }

  async download(options: {
    uid: string;
    outputFormat: OutputFormat;
    outputPath: string;
    datasetIndex?: number;
    mapUrn?: string;
    zip?: boolean;
    includeMetrics?: boolean;
    unmapped?: boolean;
  }): Promise<Record<string, unknown>> {
    const format = OUTPUT_FORMATS[options.outputFormat];
    const outputPath = this.assertAllowed(options.outputPath);
    const params = new URLSearchParams({
      uid: options.uid,
      datasetIndex: String(options.datasetIndex ?? 0),
      zip: String(options.zip ?? false),
      includeMetrics: String(options.includeMetrics ?? false),
      unmapped: String(options.unmapped ?? false),
    });
    if (options.mapUrn) params.set("map", options.mapUrn);
    const endpoint = `${this.baseUrl}/ws/public/data/download?${params}`;
    const response = await fetch(endpoint, {
      headers: { Accept: format.accept, ...this.authHeaders(), ...this.sessionHeaders(options.uid) },
    });
    if (!response.ok) throw await this.responseError(response);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(outputPath, bytes);
    return {
      uid: options.uid,
      outputFormat: options.outputFormat,
      outputPath,
      sizeBytes: bytes.byteLength,
      contentType: response.headers.get("content-type"),
      endpoint,
    };
  }

  async waitForTerminal(uid: string, timeoutSeconds = 120, pollIntervalMs = 1500): Promise<Record<string, unknown>> {
    const deadline = Date.now() + timeoutSeconds * 1000;
    let status: Record<string, unknown> = {};
    while (Date.now() < deadline) {
      status = await this.getValidationStatus(uid);
      if (isTerminalStatus(status.Status)) return status;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    throw new Error(`Timed out after ${timeoutSeconds}s waiting for FMR validation. Last status: ${JSON.stringify(status)}`);
  }

  async transformData(options: {
    inputPath: string;
    outputPath: string;
    outputFormat: OutputFormat;
    structureRef?: string;
    timeoutSeconds?: number;
    datasetIndex?: number;
  }): Promise<Record<string, unknown>> {
    const load = await this.loadData(options.inputPath);
    const uid = String(load.uid);
    let validation = await this.waitForTerminal(uid, options.timeoutSeconds ?? 120);
    if (validation.Status === "MissingDSD" && options.structureRef) {
      await this.revalidate(uid, [options.structureRef]);
      validation = await this.waitForTerminal(uid, options.timeoutSeconds ?? 120);
    }
    const preventsConversion = validation.PreventsConversion === true;
    if (validation.Status !== "Complete" || preventsConversion) {
      return {
        success: false,
        uid,
        load,
        validation,
        message: "FMR did not produce a convertible dataset. Review validation details; no output file was written.",
      };
    }
    const download = await this.download({
      uid,
      outputFormat: options.outputFormat,
      outputPath: options.outputPath,
      datasetIndex: options.datasetIndex,
    });
    return { success: true, uid, load, validation, download };
  }
}

export function clientFromEnvironment(): FmrClient {
  const allowedRoots = process.env.FMR_ALLOWED_ROOTS
    ?.split(";")
    .map((root) => root.trim())
    .filter(Boolean);
  const maxMb = Number(process.env.FMR_MAX_FILE_MB ?? "100");
  if (!Number.isFinite(maxMb) || maxMb <= 0) throw new Error("FMR_MAX_FILE_MB must be a positive number.");
  return new FmrClient({
    baseUrl: process.env.FMR_BASE_URL,
    allowedRoots,
    maxFileBytes: maxMb * 1024 * 1024,
    username: process.env.FMR_USERNAME,
    password: process.env.FMR_PASSWORD,
  });
}
