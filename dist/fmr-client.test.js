import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FmrClient } from "./fmr-client.js";
import { HttpClient } from "./http.js";
import { CATEGORISATIONS, CATEGORY_SCHEMES, CL_AREA_LATEST, DATAFLOW_FULL, DATAFLOW_STUBS, REPORT_WITH_ERRORS, } from "./test-fixtures.js";
/* A small fake of the FMR endpoints, mirroring behaviour observed on
 * fmr-sdmx.nso.go.th: session cookies, async status progression, the
 * HTTP-200 error envelope for unknown uids, and transient 503s. */
let server;
let baseUrl;
let workDir;
const hits = new Map();
const state = new Map();
let uidCounter = 0;
function json(res, status, body, headers = {}) {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(body));
}
async function readBody(req) {
    const chunks = [];
    for await (const chunk of req)
        chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
}
function count(key) {
    const value = (hits.get(key) ?? 0) + 1;
    hits.set(key, value);
    return value;
}
async function handler(req, res) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const p = decodeURIComponent(url.pathname);
    count(p);
    if (p === "/fmr/sdmx/v2/structure/dataflow/*/*/~")
        return json(res, 200, DATAFLOW_STUBS);
    if (p === "/fmr/sdmx/v2/structure/categoryscheme/*/*/~")
        return json(res, 200, CATEGORY_SCHEMES);
    if (p === "/fmr/sdmx/v2/structure/categorisation/*/*/~")
        return json(res, 200, CATEGORISATIONS);
    if (p === "/fmr/sdmx/v2/structure/agencyscheme/*/*/~")
        return json(res, 200, { data: { agencySchemes: [] } });
    if (p === "/fmr/sdmx/v2/structure/dataflow/TNSO/DF_01DI_IND_AGING/~" || p === "/fmr/sdmx/v2/structure/dataflow/TNSO/DF_01DI_IND_AGING/1.0") {
        assert.equal(url.searchParams.get("references"), "all");
        return json(res, 200, DATAFLOW_FULL);
    }
    if (p === "/fmr/sdmx/v2/structure/codelist/TNSO/CL_AREA/~")
        return json(res, 200, CL_AREA_LATEST);
    if (p === "/fmr/flaky") {
        return hits.get(p) < 3 ? json(res, 503, { error: "busy" }) : json(res, 200, { ok: true });
    }
    if (p === "/fmr/slow") {
        setTimeout(() => json(res, 200, { ok: true }), 2000);
        return;
    }
    if (p === "/fmr/ws/public/data/load" && req.method === "POST") {
        const body = await readBody(req);
        const uid = `uid-${++uidCounter}`;
        const file = /filename="([^"]+)"/.exec(body)?.[1] ?? "";
        state.set(uid, { polls: 0, revalidated: false, file });
        return json(res, 200, { Success: true, uid }, { "Set-Cookie": `JSESSIONID=${uid}-session; Path=/fmr; HttpOnly` });
    }
    if (p === "/fmr/ws/public/data/loadStatus") {
        const uid = url.searchParams.get("uid") ?? "";
        const entry = state.get(uid);
        if (!entry || req.headers.cookie !== `JSESSIONID=${uid}-session`) {
            return json(res, 200, { Error: [`No Dataset details found for UID: ${uid}`], Status: 500 });
        }
        entry.polls += 1;
        if (entry.polls === 1)
            return json(res, 200, { Status: "Validating" });
        if (entry.file.includes("plain") && !entry.revalidated)
            return json(res, 200, { Status: "MissingDSD", Errors: true });
        if (entry.file.includes("bad"))
            return json(res, 200, { ...REPORT_WITH_ERRORS, PreventsConversion: true });
        if (entry.file.includes("errors"))
            return json(res, 200, REPORT_WITH_ERRORS);
        return json(res, 200, { Status: "Complete", Errors: false, Datasets: [{ KeysCount: 1, ObsCount: 2, Errors: false }] });
    }
    if (p === "/fmr/ws/public/data/revalidate" && req.method === "POST") {
        const body = JSON.parse(await readBody(req));
        const entry = state.get(body.UID);
        if (!entry)
            return json(res, 400, { Success: false });
        entry.revalidated = true;
        entry.refs = body.SRef;
        entry.polls = 0;
        return json(res, 200, { Success: true });
    }
    if (p === "/fmr/ws/public/data/download") {
        const uid = url.searchParams.get("uid") ?? "";
        if (!state.has(uid))
            return json(res, 200, { Error: ["No Dataset details found"] });
        res.writeHead(200, { "Content-Type": "application/vnd.sdmx.data+csv;version=2.0.0" });
        res.end("STRUCTURE,STRUCTURE_ID,ACTION,SEX,AREA,FREQ,TIME_PERIOD,OBS_VALUE\r\ndataflow,TNSO:DF_01DI_IND_AGING(1.0),I,M,TH1,A,2024,1.5\r\n");
        return;
    }
    json(res, 404, { error: `no route ${p}` });
}
function makeClient(overrides = {}) {
    return new FmrClient({ baseUrl: `${baseUrl}/fmr`, allowedRoots: [workDir], retries: 2, cacheTtlMs: 60_000, ...overrides }, new HttpClient({ timeoutMs: overrides.timeoutMs ?? 5000, retries: 2, retryDelayMs: 10 }, {}));
}
before(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "fmr-mcp-test-"));
    server = createServer((req, res) => {
        handler(req, res).catch((error) => json(res, 500, { error: String(error) }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
after(() => {
    server.close();
});
test("path guard blocks files outside configured roots (any OS)", async () => {
    const client = makeClient();
    const outside = path.join(path.parse(workDir).root, "definitely-outside", "x.csv");
    await assert.rejects(() => client.loadData(outside), /outside FMR_ALLOWED_ROOTS/);
    await assert.rejects(() => client.loadData("relative/file.csv"), /must be absolute/);
    await assert.rejects(() => client.loadData(path.join(workDir, "..", "escape.csv")), /outside FMR_ALLOWED_ROOTS/);
});
test("health checks both APIs", async () => {
    const result = await makeClient().health();
    assert.equal(result.ok, true);
});
test("listDataflows is cached, searchable in Thai, and filterable by category", async () => {
    const client = makeClient();
    hits.clear();
    const all = await client.listDataflows({});
    assert.equal(all.totalDataflows, 3);
    const aging = await client.listDataflows({ search: "สูงอายุ" });
    assert.equal(aging.dataflows[0].id, "DF_01DI_IND_AGING");
    assert.match(aging.dataflows[0].urn, /^urn:sdmx:/);
    assert.deepEqual(aging.dataflows[0].categories, ["01DEM"]);
    const labour = await client.listDataflows({ category: "แรงงาน" });
    assert.deepEqual(labour.dataflows.map((flow) => flow.id), ["DF_02DI_WRK_NUM_REHAB"]);
    assert.equal(hits.get("/fmr/sdmx/v2/structure/dataflow/*/*/~"), 1, "dataflow list fetched once");
    const categories = await client.listCategories();
    assert.equal(categories.categories.find((category) => category.id === "01DEM")?.dataflowCount, 1);
});
test("getCodes uses the codelist version pinned by the DSD", async () => {
    const client = makeClient();
    const pinned = await client.getCodes({ dataflow: { id: "DF_01DI_IND_AGING" }, component: "area", search: "เชียงใหม่" });
    assert.equal(pinned.codelist.version, "1.6");
    assert.equal(pinned.codes[0].id, "TH50");
    assert.equal(pinned.codes[0].allowed, true);
    const latest = await client.getCodes({ id: "CL_AREA" });
    assert.equal(latest.codelist.version, "1.8");
    assert.equal(latest.totalCodes, 9);
});
test("mapCodes writes a review CSV with BOM", async () => {
    const client = makeClient();
    const target = path.join(workDir, "review", "area-map.csv");
    const result = await client.mapCodes({
        dataflow: { id: "DF_01DI_IND_AGING" },
        component: "AREA",
        values: ["กรุงเทพมหานคร", "เชียงไหม่", "จ.นนทบุรี"],
        outputPath: target,
    });
    assert.deepEqual(result.mapping, { "กรุงเทพมหานคร": "TH1", "จ.นนทบุรี": "TH12" });
    assert.equal(result.review.length, 1);
    const text = await readFile(target, "utf8");
    assert.ok(text.startsWith("﻿input,"));
    await assert.rejects(() => client.mapCodes({ dataflow: { id: "DF_01DI_IND_AGING" }, component: "AREA", values: ["x"], outputPath: target }), /already exists/);
    await assert.rejects(() => client.mapCodes({ dataflow: { id: "DF_01DI_IND_AGING" }, component: "NOPE", values: ["x"] }), /Components: SEX, AREA, FREQ/);
});
test("csvTemplate writes an SDMX-CSV 2.0 header", async () => {
    const client = makeClient();
    const target = path.join(workDir, "template.csv");
    const result = await client.csvTemplate({ dataflow: { urn: "urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_01DI_IND_AGING(1.0)" }, outputPath: target });
    assert.equal(result.structureId, "TNSO:DF_01DI_IND_AGING(1.0)");
    assert.equal((await readFile(target, "utf8")).trim(), "STRUCTURE,STRUCTURE_ID,ACTION,SEX,AREA,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE");
});
test("retries transient 503s on GET", async () => {
    const client = makeClient();
    hits.delete("/fmr/flaky");
    const response = await client.http.request(`${baseUrl}/fmr/flaky`);
    assert.equal(response.status, 200);
    assert.equal(hits.get("/fmr/flaky"), 3);
});
test("times out instead of hanging", async () => {
    const http = new HttpClient({ timeoutMs: 200, retries: 0 }, {});
    await assert.rejects(() => http.request(`${baseUrl}/fmr/slow`), /timed out after/);
});
test("unknown or expired uid fails fast with a clear message", async () => {
    const client = makeClient();
    const started = Date.now();
    await assert.rejects(() => client.waitForTerminal("missing-uid", 30), /no dataset for uid missing-uid.*Upload the file again/s);
    assert.ok(Date.now() - started < 5000, "did not poll until timeout");
});
test("transformData: SDMX file converts and writes the report", async () => {
    const client = makeClient();
    const input = path.join(workDir, "clean.csv");
    await writeFile(input, "STRUCTURE,STRUCTURE_ID,ACTION,SEX,AREA,FREQ,TIME_PERIOD,OBS_VALUE\n");
    const output = path.join(workDir, "out", "clean-sdmx.csv");
    const result = await client.transformData({ inputPath: input, outputPath: output, outputFormat: "sdmx-csv-2.0" });
    assert.equal(result.success, true);
    assert.equal(result.summary.verdict, "clean");
    assert.match(await readFile(output, "utf8"), /TNSO:DF_01DI_IND_AGING/);
    assert.ok(JSON.parse(await readFile(`${output}.validation.json`, "utf8")).Status === "Complete");
    await assert.rejects(() => client.transformData({ inputPath: input, outputPath: output, outputFormat: "sdmx-csv-2.0" }), /already exists/);
});
test("transformData: MissingDSD is revalidated with all structure_refs", async () => {
    const client = makeClient();
    const input = path.join(workDir, "plain.csv");
    await writeFile(input, "SEX,AREA,FREQ,TIME_PERIOD,OBS_VALUE\n");
    const refs = [
        "urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_01DI_IND_AGING(1.0)",
        "urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_02DI_WRK_NUM_REHAB(1.0)",
    ];
    const result = await client.transformData({ inputPath: input, outputPath: path.join(workDir, "plain-out.csv"), outputFormat: "sdmx-csv-2.0", structureRefs: refs });
    assert.equal(result.success, true);
    assert.equal(result.revalidated, true);
    assert.deepEqual(state.get(result.uid)?.refs, refs);
    const missing = await client.validateOnly({ inputPath: input });
    assert.equal(missing.summary.verdict, "structure_problem");
    assert.match(missing.nextStep, /structure_refs/);
});
test("transformData: blocked conversion writes no output but keeps the report", async () => {
    const client = makeClient();
    const input = path.join(workDir, "bad.csv");
    await writeFile(input, "x\n");
    const output = path.join(workDir, "bad-out.csv");
    const result = await client.transformData({ inputPath: input, outputPath: output, outputFormat: "sdmx-csv-2.0" });
    assert.equal(result.success, false);
    assert.equal(result.summary.verdict, "blocked");
    assert.equal(result.summary.datasets[0].issueGroups[0].count, 3);
    await assert.rejects(() => readFile(output));
    assert.ok((await readFile(`${output}.validation.json`, "utf8")).includes("Representation"));
});
test("transformData: convertible-with-errors still converts and says so", async () => {
    const client = makeClient();
    const input = path.join(workDir, "errors.csv");
    await writeFile(input, "x\n");
    const result = await client.transformData({ inputPath: input, outputPath: path.join(workDir, "errors-out.csv"), outputFormat: "sdmx-csv-2.0" });
    assert.equal(result.success, true);
    assert.match(result.message, /4 validation error/);
});
test("revalidate rejects non-structure URNs", async () => {
    await assert.rejects(() => makeClient().revalidate("u", ["urn:sdmx:org.sdmx.infomodel.codelist.Codelist=TNSO:CL_AREA(1.6)"]), /must be Dataflow/);
});
test("loadData checks size before reading", async () => {
    const client = makeClient({ maxFileBytes: 10 });
    const input = path.join(workDir, "big.csv");
    await writeFile(input, "0123456789ABCDEF");
    await assert.rejects(() => client.loadData(input), /over the FMR_MAX_FILE_MB limit/);
});
//# sourceMappingURL=fmr-client.test.js.map