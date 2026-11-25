import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { FormData } from "undici";
import { TtlCache } from "./cache.js";
import { configFromEnv, defaultConfig } from "./config.js";
import { ensureOk, FmrHttpError, HttpClient } from "./http.js";
import { categoriesFromSchemes, categorisationIndex, codesFromCodelist, csvColumnGuide, csvHeader, csvLine, dataflowSummaries, describeDataflowMessage, findCodelist, matchValues, normalizeLabel, parseUrn, refKey, searchCodes, } from "./structure.js";
import { errorEnvelope, isTerminalStatus, STATUS_HINTS, STRUCTURE_STATUSES, summarizeValidation, } from "./validation.js";
export { isTerminalStatus } from "./validation.js";
export const OUTPUT_FORMATS = {
    "sdmx-csv-1.0": { accept: "application/vnd.sdmx.data+csv;version=1.0.0", extension: ".csv" },
    "sdmx-csv-2.0": { accept: "application/vnd.sdmx.data+csv;version=2.0.0", extension: ".csv" },
    "sdmx-json-1.0": { accept: "application/vnd.sdmx.data+json;version=1.0.0", extension: ".json" },
    "sdmx-ml-2.1-structure-specific": { accept: "application/vnd.sdmx.structurespecificdata+xml;version=2.1", extension: ".xml" },
    "sdmx-ml-2.1-generic": { accept: "application/vnd.sdmx.genericdata+xml;version=2.1", extension: ".xml" },
};
const STRUCTURE_JSON = "application/vnd.sdmx.structure+json;version=2.0.0";
const STRUCTURE_XML = "application/vnd.sdmx.structure+xml;version=2.1";
/** v1 resource names that are spelled differently in the SDMX v2 REST API. */
const V2_RESOURCE = {
    contentconstraint: "dataconstraint",
    structure: "*",
};
export class FmrClient {
    config;
    http;
    sessions = new Map();
    structures;
    constructor(config = {}, http) {
        this.config = defaultConfig(config);
        this.http = http ?? new HttpClient({ timeoutMs: this.config.timeoutMs, retries: this.config.retries, proxyUrl: this.config.proxyUrl });
        this.structures = new TtlCache(this.config.cacheTtlMs);
    }
    get baseUrl() {
        return this.config.baseUrl;
    }
    get allowedRoots() {
        return this.config.allowedRoots;
    }
    // ------------------------------------------------------------ plumbing
    authHeaders() {
        const { username, password } = this.config;
        if (!username && !password)
            return {};
        if (!username || !password)
            throw new Error("Both FMR_USERNAME and FMR_PASSWORD must be set together.");
        return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
    }
    purgeSessions() {
        // Keep entries a while past FMR's own expiry so the error can say "expired".
        const cutoff = Date.now() - this.config.sessionTtlMs * 4;
        for (const [uid, session] of this.sessions)
            if (session.lastUsed < cutoff)
                this.sessions.delete(uid);
    }
    sessionHeaders(uid) {
        this.purgeSessions();
        const cookie = this.sessions.get(uid)?.cookie;
        return cookie ? { Cookie: cookie } : {};
    }
    touch(uid) {
        const session = this.sessions.get(uid);
        if (session)
            session.lastUsed = Date.now();
    }
    rememberSession(uid, setCookies, filePath) {
        const cookie = setCookies.map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ") || undefined;
        this.sessions.set(uid, { cookie, lastUsed: Date.now(), filePath });
    }
    expiryHint(uid) {
        const session = this.sessions.get(uid);
        const minutes = Math.round(this.config.sessionTtlMs / 60_000);
        if (!session) {
            return `This MCP process has no record of uid ${uid} (it may come from another session or the server was restarted). Upload the file again with fmr_load_data.`;
        }
        const idle = Math.round((Date.now() - session.lastUsed) / 60_000);
        return `Uploads expire after about ${minutes} minutes of inactivity (this one was idle ~${idle} min). Upload the file again with fmr_load_data${session.filePath ? ` (${session.filePath})` : ""}.`;
    }
    assertAllowed(filePath) {
        if (!path.isAbsolute(filePath))
            throw new Error(`Path must be absolute: ${filePath}`);
        const resolved = path.resolve(filePath);
        const allowed = this.config.allowedRoots.some((root) => {
            const relative = path.relative(root, resolved);
            return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
        });
        if (!allowed) {
            throw new Error(`Path is outside FMR_ALLOWED_ROOTS (${this.config.allowedRoots.join("; ")}): ${resolved}`);
        }
        return resolved;
    }
    async prepareOutput(outputPath, overwrite) {
        const resolved = this.assertAllowed(outputPath);
        if (!overwrite) {
            const exists = await access(resolved).then(() => true, () => false);
            if (exists)
                throw new Error(`Output file already exists: ${resolved}. Pass overwrite=true to replace it.`);
        }
        await mkdir(path.dirname(resolved), { recursive: true });
        return resolved;
    }
    structureUrl(pathPart, params = {}) {
        const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined));
        const suffix = query.toString();
        return `${this.config.baseUrl}/sdmx/v2/structure/${pathPart}${suffix ? `?${suffix}` : ""}`;
    }
    async getStructureJson(url) {
        return this.structures.get(url, async () => {
            const response = await ensureOk(await this.http.request(url, {
                headers: { Accept: STRUCTURE_JSON, "Accept-Language": `${this.config.language}, en;q=0.8, *;q=0.5`, ...this.authHeaders() },
            }), url);
            const text = await response.text();
            try {
                return JSON.parse(text);
            }
            catch {
                throw new FmrHttpError(`FMR returned non-JSON structure data for ${url}: ${text.slice(0, 300)}`);
            }
        });
    }
    static segment(value, fallback) {
        const v = value?.trim() || fallback;
        return v === "all" ? "*" : v === "latest" ? "~" : encodeURIComponent(v).replace(/%2C/gi, ",");
    }
    resolveDataflow(lookup) {
        if (lookup.urn) {
            const parsed = parseUrn(lookup.urn);
            if (!parsed || !/Dataflow$/.test(parsed.className))
                throw new Error(`Not a dataflow URN: ${lookup.urn}`);
            return { agency: parsed.agency, id: parsed.id, version: parsed.version };
        }
        if (!lookup.id)
            throw new Error("Give a dataflow as urn, or as agency + id (+ version).");
        return { agency: lookup.agency || "TNSO", id: lookup.id, version: lookup.version || "~" };
    }
    // ------------------------------------------------------------ health
    async health() {
        const check = async (url, accept) => {
            const started = Date.now();
            try {
                const response = await this.http.request(url, { headers: { Accept: accept, ...this.authHeaders() }, retries: 0 });
                await response.body?.cancel().catch(() => undefined);
                return { ok: response.ok, status: response.status, elapsedMs: Date.now() - started };
            }
            catch (error) {
                return { ok: false, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started };
            }
        };
        const [structureApi, dataApi] = await Promise.all([
            check(this.structureUrl("agencyscheme/*/*/~", { detail: "allstubs" }), STRUCTURE_JSON),
            // An unknown uid answers 200 with an error envelope: proves the data API is up without uploading.
            check(`${this.config.baseUrl}/ws/public/data/loadStatus?uid=health-check`, "application/json"),
        ]);
        return {
            ok: structureApi.ok && dataApi.ok,
            baseUrl: this.config.baseUrl,
            proxy: this.http.proxy ?? null,
            structureApi,
            dataApi,
            cache: { entries: this.structures.size, ttlSeconds: this.config.cacheTtlMs / 1000 },
            allowedRoots: this.config.allowedRoots,
        };
    }
    // ------------------------------------------------------------ discovery
    async allDataflows() {
        const url = this.structureUrl("dataflow/*/*/~", { detail: "allstubs" });
        return { flows: dataflowSummaries(await this.getStructureJson(url), this.config.language), url };
    }
    async categoryData() {
        const [schemes, categorisations] = await Promise.all([
            this.getStructureJson(this.structureUrl("categoryscheme/*/*/~")),
            this.getStructureJson(this.structureUrl("categorisation/*/*/~")),
        ]);
        return { categories: categoriesFromSchemes(schemes, this.config.language), index: categorisationIndex(categorisations) };
    }
    async listDataflows(options = {}) {
        const { flows, url } = await this.allDataflows();
        let items = flows;
        if (options.agency)
            items = items.filter((item) => item.agency.toLowerCase() === options.agency.toLowerCase());
        let categoryIndex;
        let categoryError;
        try {
            categoryIndex = (await this.categoryData()).index;
        }
        catch (error) {
            categoryError = error instanceof Error ? error.message : String(error);
            if (options.category)
                throw error;
        }
        if (options.category && categoryIndex) {
            const { categories } = await this.categoryData();
            const wanted = normalizeLabel(options.category);
            const ids = new Set(categories.filter((category) => category.id.toLowerCase() === wanted
                || normalizeLabel(category.name ?? "").includes(wanted)).map((category) => category.id));
            if (!ids.size)
                throw new Error(`Unknown category "${options.category}". Call fmr_list_categories to see the category ids.`);
            items = items.filter((item) => (categoryIndex.get(refKey(item)) ?? []).some((id) => ids.has(id)));
        }
        const query = options.search?.trim();
        if (query) {
            const tokens = normalizeLabel(query).split(" ").filter(Boolean);
            const scored = [];
            for (const item of items) {
                const haystack = normalizeLabel([item.id, item.agency, ...Object.values(item.names ?? {}), item.description ?? ""].join(" "));
                const compactHaystack = haystack.replace(/ /g, "");
                if (!tokens.every((token) => haystack.includes(token) || compactHaystack.includes(token)))
                    continue;
                const id = item.id.toLowerCase();
                const q = query.toLowerCase();
                const rank = id === q ? 0 : id.startsWith(q) ? 1 : normalizeLabel(item.name ?? "").includes(normalizeLabel(query)) ? 2 : 3;
                scored.push({ item, rank });
            }
            items = scored.sort((a, b) => a.rank - b.rank).map((entry) => entry.item);
        }
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 20;
        const page = items.slice(offset, offset + limit).map((item) => ({
            urn: item.urn,
            agency: item.agency,
            id: item.id,
            version: item.version,
            name: item.name,
            categories: categoryIndex?.get(refKey(item)),
        }));
        return {
            totalDataflows: flows.length,
            totalMatched: items.length,
            offset,
            returned: page.length,
            dataflows: page,
            cacheAgeSeconds: this.structures.ageSeconds(url) ?? 0,
            ...(categoryError ? { categoryWarning: `Categories unavailable: ${categoryError}` } : {}),
        };
    }
    async listCategories() {
        const [{ categories, index }, { flows }] = await Promise.all([this.categoryData(), this.allDataflows()]);
        const counts = new Map();
        for (const flow of flows)
            for (const id of index.get(refKey(flow)) ?? [])
                counts.set(id, (counts.get(id) ?? 0) + 1);
        return {
            categories: categories.map((category) => ({ ...category, dataflowCount: counts.get(category.id) ?? 0 })),
            uncategorisedDataflows: flows.filter((flow) => !(index.get(refKey(flow)) ?? []).length).length,
        };
    }
    async getStructure(options) {
        const format = options.format ?? "json";
        let url;
        let accept;
        if (format === "json") {
            const resource = V2_RESOURCE[options.resource] ?? options.resource;
            url = this.structureUrl(`${resource}/${FmrClient.segment(options.agency, "*")}/${FmrClient.segment(options.id, "*")}/${FmrClient.segment(options.version, "~")}`, { references: options.references ?? "none", detail: options.detail });
            accept = STRUCTURE_JSON;
        }
        else {
            const version = options.version && options.version !== "~" ? options.version : "latest";
            url = `${this.config.baseUrl}/ws/public/sdmxapi/rest/${encodeURIComponent(options.resource)}/${encodeURIComponent(options.agency)}/${encodeURIComponent(options.id)}/${encodeURIComponent(version)}?references=${encodeURIComponent(options.references ?? "none")}${options.detail ? `&detail=${encodeURIComponent(options.detail)}` : ""}`;
            accept = STRUCTURE_XML;
        }
        const response = await ensureOk(await this.http.request(url, { headers: { Accept: accept, ...this.authHeaders() } }), url);
        const body = await response.text();
        const maxChars = options.maxChars ?? 50_000;
        return {
            endpoint: url,
            format,
            contentType: response.headers.get("content-type"),
            totalChars: body.length,
            truncated: body.length > maxChars,
            body: body.slice(0, maxChars),
            hint: body.length > maxChars ? "Truncated. Prefer fmr_describe_dataflow / fmr_get_codes, or use detail=allstubs." : undefined,
        };
    }
    async dataflowMessage(lookup) {
        const ref = this.resolveDataflow(lookup);
        const url = this.structureUrl(`dataflow/${FmrClient.segment(ref.agency, "TNSO")}/${FmrClient.segment(ref.id, "*")}/${FmrClient.segment(ref.version, "~")}`, { references: "all" });
        return { message: await this.getStructureJson(url), ref };
    }
    async describeDataflow(lookup) {
        const { message, ref } = await this.dataflowMessage(lookup);
        return describeDataflowMessage(message, ref, this.config.language);
    }
    /** describeDataflow with long allowed-code lists shortened for display. */
    async describeDataflowForDisplay(lookup, maxAllowedCodes = 50) {
        const description = await this.describeDataflow(lookup);
        const cap = (component) => (component.allowedCodes && component.allowedCodes.length > maxAllowedCodes
            ? { ...component, allowedCodes: component.allowedCodes.slice(0, maxAllowedCodes) }
            : component);
        return { ...description, dimensions: description.dimensions.map(cap), attributes: description.attributes.map(cap) };
    }
    async codesFor(options) {
        if (options.dataflow && options.component) {
            const { message, ref } = await this.dataflowMessage(options.dataflow);
            const description = describeDataflowMessage(message, ref, this.config.language);
            const wanted = options.component.toUpperCase();
            const component = [...description.dimensions, ...description.attributes, ...(description.timeDimension ? [description.timeDimension] : [])]
                .find((item) => item.id.toUpperCase() === wanted);
            if (!component) {
                const ids = [...description.dimensions, ...description.attributes].map((item) => item.id).join(", ");
                throw new Error(`Component ${options.component} is not in ${description.structureId}. Components: ${ids}`);
            }
            if (!component.codelist)
                throw new Error(`Component ${component.id} is not coded (data type ${component.dataType ?? "unknown"}).`);
            // Use the codelist version the DSD references, not the latest one.
            let codelistNode = findCodelist(message, component.codelist);
            if (!codelistNode) {
                const url = this.structureUrl(`codelist/${component.codelist.agency}/${component.codelist.id}/${component.codelist.version}`);
                codelistNode = findCodelist(await this.getStructureJson(url), component.codelist);
            }
            if (!codelistNode)
                throw new Error(`Codelist ${refKey(component.codelist)} not found in FMR.`);
            const allowedCodes = component.allowedCodes;
            return {
                codelist: { ...component.codelist },
                codes: codesFromCodelist(codelistNode, this.config.language),
                allowed: allowedCodes ? new Set(allowedCodes) : undefined,
                componentId: component.id,
            };
        }
        let ref;
        if (options.codelistUrn) {
            const parsed = parseUrn(options.codelistUrn);
            if (!parsed || !/Codelist$/.test(parsed.className))
                throw new Error(`Not a codelist URN: ${options.codelistUrn}`);
            ref = parsed;
        }
        else if (options.id) {
            ref = { agency: options.agency || "TNSO", id: options.id, version: options.version || "~" };
        }
        else {
            throw new Error("Give codelist_urn, or codelist id (+ agency, version), or dataflow + component.");
        }
        const url = this.structureUrl(`codelist/${FmrClient.segment(ref.agency, "TNSO")}/${FmrClient.segment(ref.id, "*")}/${FmrClient.segment(ref.version, "~")}`);
        const node = findCodelist(await this.getStructureJson(url), ref);
        if (!node)
            throw new Error(`Codelist ${refKey(ref)} not found in FMR.`);
        const actual = { agency: String(node.agencyID), id: String(node.id), version: String(node.version) };
        return { codelist: { ...actual, urn: `urn:sdmx:org.sdmx.infomodel.codelist.Codelist=${refKey(actual)}` }, codes: codesFromCodelist(node, this.config.language) };
    }
    async getCodes(options) {
        const { codelist, codes, allowed, componentId } = await this.codesFor(options);
        const result = searchCodes(codes, { search: options.search, parent: options.parent, limit: options.limit ?? 50, offset: options.offset ?? 0 });
        return {
            codelist,
            component: componentId,
            totalCodes: codes.length,
            totalMatched: result.totalMatched,
            offset: options.offset ?? 0,
            returned: result.codes.length,
            codes: result.codes.map((code) => ({
                id: code.id,
                name: code.name,
                ...(code.parent ? { parent: code.parent } : {}),
                ...(allowed ? { allowed: allowed.has(code.id) } : {}),
            })),
        };
    }
    async mapCodes(options) {
        const { codelist, codes, allowed, componentId } = await this.codesFor({ dataflow: options.dataflow, component: options.component });
        const matches = matchValues(options.values, codes, allowed);
        const summary = {};
        for (const match of matches)
            summary[match.status] = (summary[match.status] ?? 0) + 1;
        const mapping = Object.fromEntries(matches.filter((match) => match.status === "matched").map((match) => [match.input, match.code]));
        let written;
        if (options.outputPath) {
            const target = await this.prepareOutput(options.outputPath, options.overwrite ?? false);
            const lines = [csvLine(["input", "occurrences", "status", "code", "name", "confidence", "method", "candidates"])];
            for (const match of matches) {
                lines.push(csvLine([
                    match.input, String(match.occurrences), match.status, match.code ?? "", match.name ?? "",
                    match.confidence !== undefined ? String(match.confidence) : "", match.method ?? "",
                    (match.candidates ?? []).map((candidate) => `${candidate.code} ${candidate.name ?? ""} (${candidate.confidence})`).join(" | "),
                ]));
            }
            // BOM so Excel opens Thai text correctly.
            await writeFile(target, `﻿${lines.join("\r\n")}\r\n`, "utf8");
            written = target;
        }
        return {
            codelist,
            component: componentId,
            distinctValues: matches.length,
            summary,
            mapping,
            review: matches.filter((match) => match.status !== "matched" && match.status !== "blank"),
            matchedDetails: matches.filter((match) => match.status === "matched" && match.method !== "id" && match.method !== "name")
                .map(({ input, code, name, method, confidence }) => ({ input, code, name, method, confidence })),
            outputPath: written,
            note: "Only 'matched' values are safe to apply automatically. A person must confirm 'needs_review' and 'ambiguous' values. Blank values are missing data, not zero.",
        };
    }
    async csvTemplate(options) {
        const description = await this.describeDataflow(options.dataflow);
        const include = options.includeOptionalAttributes ?? false;
        const header = csvHeader(description, include);
        const columns = csvColumnGuide(description, include);
        let written;
        if (options.outputPath) {
            const target = await this.prepareOutput(options.outputPath, options.overwrite ?? false);
            await writeFile(target, `${csvLine(header)}\r\n`, "utf8");
            written = target;
        }
        const example = columns.map((column) => column.value ?? (column.role === "measure" ? "" : `<${column.column}>`));
        return {
            dataflow: description.urn,
            structureId: description.structureId,
            format: "SDMX-CSV 2.0",
            header,
            exampleRow: csvLine(example),
            columns,
            outputPath: written,
            notes: [
                "Each row is one observation. Put codes (not labels) in coded columns; use fmr_map_codes to convert labels.",
                "A file with STRUCTURE/STRUCTURE_ID columns identifies its own structure, so no structure_refs are needed.",
                "Save as UTF-8.",
            ],
        };
    }
    // ------------------------------------------------------------ data
    async loadData(filePath) {
        const resolved = this.assertAllowed(filePath);
        const info = await stat(resolved).catch(() => {
            throw new Error(`File not found: ${resolved}`);
        });
        if (!info.isFile())
            throw new Error(`Not a file: ${resolved}`);
        if (info.size > this.config.maxFileBytes) {
            throw new Error(`File is ${(info.size / 1048576).toFixed(1)} MB, over the FMR_MAX_FILE_MB limit of ${(this.config.maxFileBytes / 1048576).toFixed(1)} MB.`);
        }
        if (info.size === 0)
            throw new Error(`File is empty: ${resolved}`);
        const bytes = await readFile(resolved);
        const form = new FormData();
        form.append("uploadFile", new Blob([bytes]), path.basename(resolved));
        const url = `${this.config.baseUrl}/ws/public/data/load`;
        const response = await ensureOk(await this.http.request(url, {
            method: "POST",
            headers: { Accept: "application/json", ...this.authHeaders() },
            body: form,
            timeoutMs: this.config.uploadTimeoutMs,
        }), url);
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        }
        catch {
            throw new FmrHttpError(`FMR load returned non-JSON: ${text.slice(0, 500)}`);
        }
        if (result?.Success === false)
            throw new Error(`FMR rejected the upload: ${JSON.stringify(result).slice(0, 1000)}`);
        const uid = String(result?.uid ?? result?.UID ?? "");
        if (!uid)
            throw new Error(`FMR did not return a dataset uid: ${JSON.stringify(result).slice(0, 1000)}`);
        this.rememberSession(uid, response.headers.getSetCookie?.() ?? [], resolved);
        return {
            uid,
            filePath: resolved,
            sizeBytes: info.size,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            uploadedAt: new Date().toISOString(),
        };
    }
    /** Raw FMR validation report. Throws a clear error for unknown/expired uids. */
    async getValidationReport(uid) {
        const url = `${this.config.baseUrl}/ws/public/data/loadStatus?uid=${encodeURIComponent(uid)}`;
        const response = await this.http.request(url, { headers: { Accept: "application/json", ...this.authHeaders(), ...this.sessionHeaders(uid) } });
        const text = await response.text();
        let report;
        try {
            report = JSON.parse(text);
        }
        catch {
            if (!response.ok)
                throw new FmrHttpError(`FMR loadStatus failed (${response.status}): ${text.slice(0, 500)}`, response.status, text);
            throw new FmrHttpError(`FMR loadStatus returned non-JSON: ${text.slice(0, 500)}`);
        }
        // FMR answers HTTP 400 with a JSON report for unreadable data / bad refs; keep those.
        const envelope = errorEnvelope(report);
        if (envelope && /no dataset details found|not found|expired/i.test(envelope)) {
            throw new Error(`FMR has no dataset for uid ${uid}: ${envelope}. ${this.expiryHint(uid)}`);
        }
        if (!response.ok && typeof report?.Status !== "string") {
            throw new FmrHttpError(`FMR loadStatus failed (${response.status}): ${text.slice(0, 500)}`, response.status, text);
        }
        this.touch(uid);
        return report;
    }
    async getValidationStatus(uid, options = {}) {
        const report = await this.getValidationReport(uid);
        const written = options.reportPath ? await this.writeReport(report, options.reportPath, options.overwrite ?? true) : undefined;
        if (options.detail === "full")
            return { uid, reportPath: written, report };
        return { uid, reportPath: written, summary: summarizeValidation(report, options) };
    }
    async writeReport(report, reportPath, overwrite) {
        const target = await this.prepareOutput(reportPath, overwrite);
        await writeFile(target, JSON.stringify(report, null, 2), "utf8");
        return target;
    }
    async revalidate(uid, structureRefs) {
        for (const ref of structureRefs) {
            const parsed = parseUrn(ref);
            if (!parsed || !/(Dataflow|DataStructure|ProvisionAgreement)$/.test(parsed.className)) {
                throw new Error(`structure_refs must be Dataflow, DataStructure or ProvisionAgreement URNs; got ${ref}`);
            }
        }
        const url = `${this.config.baseUrl}/ws/public/data/revalidate`;
        const response = await this.http.request(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...this.authHeaders(), ...this.sessionHeaders(uid) },
            body: JSON.stringify({ UID: uid, SRef: structureRefs }),
        });
        const text = await response.text();
        if (!response.ok)
            throw new FmrHttpError(`FMR revalidate failed (${response.status}): ${text.slice(0, 1000)}. ${this.expiryHint(uid)}`, response.status, text);
        let result = {};
        try {
            result = text ? JSON.parse(text) : {};
        }
        catch {
            result = { raw: text.slice(0, 500) };
        }
        if (result?.Success === false)
            throw new Error(`FMR refused revalidation: ${text.slice(0, 1000)}`);
        this.touch(uid);
        return { uid, structureRefs, ...result };
    }
    async download(options) {
        const format = OUTPUT_FORMATS[options.outputFormat];
        const outputPath = await this.prepareOutput(options.outputPath, options.overwrite ?? false);
        const params = new URLSearchParams({
            uid: options.uid,
            datasetIndex: String(options.datasetIndex ?? 0),
            zip: String(options.zip ?? false),
            includeMetrics: String(options.includeMetrics ?? false),
            unmapped: String(options.unmapped ?? false),
        });
        if (options.mapUrn)
            params.set("map", options.mapUrn);
        const url = `${this.config.baseUrl}/ws/public/data/download?${params}`;
        const response = await this.http.request(url, {
            headers: { Accept: format.accept, ...this.authHeaders(), ...this.sessionHeaders(options.uid) },
            timeoutMs: this.config.uploadTimeoutMs,
        });
        if (!response.ok) {
            const body = (await response.text()).slice(0, 1000);
            throw new FmrHttpError(`FMR download failed (${response.status}): ${body}. ${/not found|uid/i.test(body) ? this.expiryHint(options.uid) : ""}`, response.status, body);
        }
        const bytes = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") ?? "";
        if (/json/i.test(contentType) && !/json/i.test(format.accept) && !options.zip) {
            const text = bytes.toString("utf8");
            if (/"Error"/.test(text))
                throw new Error(`FMR returned an error instead of data: ${text.slice(0, 1000)}. ${this.expiryHint(options.uid)}`);
        }
        if (bytes.byteLength === 0)
            throw new Error("FMR returned an empty file. Check datasetIndex and the validation status.");
        await writeFile(outputPath, bytes);
        this.touch(options.uid);
        const expectedExtension = options.zip ? ".zip" : format.extension;
        return {
            uid: options.uid,
            outputFormat: options.outputFormat,
            outputPath,
            sizeBytes: bytes.byteLength,
            contentType,
            ...(path.extname(outputPath).toLowerCase() !== expectedExtension
                ? { warning: `Output file extension is ${path.extname(outputPath) || "(none)"}; ${expectedExtension} is expected for ${options.zip ? "zip" : options.outputFormat}.` }
                : {}),
        };
    }
    async waitForTerminal(uid, timeoutSeconds = 120) {
        const deadline = Date.now() + timeoutSeconds * 1000;
        let report = {};
        let delay = 1000;
        for (;;) {
            report = await this.getValidationReport(uid);
            if (isTerminalStatus(report?.Status))
                return report;
            const envelope = errorEnvelope(report);
            if (envelope)
                throw new Error(`FMR reported an error for uid ${uid}: ${envelope}`);
            if (Date.now() + delay > deadline)
                break;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(Math.round(delay * 1.5), 5000);
        }
        throw new Error(`Timed out after ${timeoutSeconds}s waiting for FMR validation (last status: ${report?.Status ?? "unknown"}). Call fmr_get_validation_status with uid ${uid} to keep checking.`);
    }
    /** Upload, wait, and revalidate with structure refs when FMR needs them. */
    async validateFile(options) {
        const load = await this.loadData(options.inputPath);
        const uid = String(load.uid);
        let report = await this.waitForTerminal(uid, options.timeoutSeconds ?? 120);
        let revalidated = false;
        if (STRUCTURE_STATUSES.has(report.Status) && options.structureRefs?.length) {
            await this.revalidate(uid, options.structureRefs);
            revalidated = true;
            report = await this.waitForTerminal(uid, options.timeoutSeconds ?? 120);
        }
        const reportPath = options.reportPath ? await this.writeReport(report, options.reportPath, true) : undefined;
        return { uid, load, report, summary: summarizeValidation(report, options), revalidated, reportPath };
    }
    async validateOnly(options) {
        const result = await this.validateFile(options);
        return {
            uid: result.uid,
            load: result.load,
            revalidated: result.revalidated,
            reportPath: result.reportPath,
            summary: result.summary,
            nextStep: result.summary.verdict === "structure_problem" && !options.structureRefs?.length
                ? STATUS_HINTS[result.summary.status]
                : result.summary.verdict === "clean" || result.summary.verdict === "has_errors_but_convertible"
                    ? `Use fmr_download with uid ${result.uid} within ~${Math.round(this.config.sessionTtlMs / 60_000)} minutes to get a converted file.`
                    : undefined,
        };
    }
    async transformData(options) {
        // Fail fast on the output location before uploading anything.
        const outputPath = this.assertAllowed(options.outputPath);
        if (!options.overwrite && await access(outputPath).then(() => true, () => false)) {
            throw new Error(`Output file already exists: ${outputPath}. Pass overwrite=true to replace it.`);
        }
        const reportPath = options.reportPath ?? `${outputPath}.validation.json`;
        this.assertAllowed(reportPath);
        await mkdir(path.dirname(outputPath), { recursive: true });
        const result = await this.validateFile({ ...options, reportPath });
        const { summary } = result;
        if (summary.status !== "Complete" || summary.preventsConversion === true) {
            return {
                success: false,
                uid: result.uid,
                load: result.load,
                revalidated: result.revalidated,
                reportPath: result.reportPath,
                summary,
                message: "FMR did not produce a convertible dataset; no output file was written. "
                    + (summary.hint ?? "Review the validation summary."),
            };
        }
        const download = await this.download({
            uid: result.uid,
            outputFormat: options.outputFormat,
            outputPath,
            datasetIndex: options.datasetIndex,
            overwrite: options.overwrite,
        });
        return {
            success: true,
            uid: result.uid,
            load: result.load,
            revalidated: result.revalidated,
            reportPath: result.reportPath,
            summary,
            download,
            message: summary.hasErrors
                ? `Converted, but FMR reported ${summary.totalErrors} validation error(s). Report them before the file is used; conversion is not publication.`
                : "Converted with no validation errors. Conversion is not publication.",
        };
    }
}
export function clientFromEnvironment(env = process.env) {
    return new FmrClient(configFromEnv(env));
}
//# sourceMappingURL=fmr-client.js.map