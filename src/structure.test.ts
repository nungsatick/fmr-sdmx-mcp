import test from "node:test";
import assert from "node:assert/strict";
import {
  csvHeader,
  dataflowSummaries,
  describeDataflowMessage,
  matchValues,
  normalizeLabel,
  parseUrn,
  searchCodes,
  codesFromCodelist,
} from "./structure.js";
import { DATAFLOW_FULL, DATAFLOW_STUBS } from "./test-fixtures.js";

test("parseUrn handles artefacts and items", () => {
  assert.deepEqual(parseUrn("urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_X(1.0)"), {
    className: "datastructure.Dataflow", agency: "TNSO", id: "DF_X", version: "1.0", item: undefined,
  });
  assert.equal(parseUrn("urn:sdmx:org.sdmx.infomodel.categoryscheme.Category=TNSO:CAT(1.0).01DEM")?.item, "01DEM");
  assert.equal(parseUrn("not a urn"), undefined);
});

test("dataflowSummaries reads Thai names and builds URNs", () => {
  const flows = dataflowSummaries(DATAFLOW_STUBS, "th");
  assert.equal(flows.length, 3);
  assert.equal(flows[0].name, "ชุดข้อมูลดัชนีการสูงอายุ");
  assert.equal(flows[0].urn, "urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_01DI_IND_AGING(1.0)");
  // English requested but only Thai available: falls back to Thai.
  assert.equal(dataflowSummaries(DATAFLOW_STUBS, "en")[0].name, "ชุดข้อมูลดัชนีการสูงอายุ");
});

test("describeDataflowMessage orders dimensions and pins codelist versions", () => {
  const description = describeDataflowMessage(DATAFLOW_FULL, { agency: "TNSO", id: "DF_01DI_IND_AGING", version: "~" }, "th");
  assert.deepEqual(description.dimensions.map((dimension) => dimension.id), ["SEX", "AREA", "FREQ"]);
  const area = description.dimensions.find((dimension) => dimension.id === "AREA")!;
  assert.equal(area.codelist?.version, "1.6");
  assert.equal(area.codelist?.codeCount, 8);
  assert.equal(area.name, "พื้นที่");
  assert.equal(area.allowedCodeCount, 6);
  assert.equal(description.timeDimension?.id, "TIME_PERIOD");
  assert.equal(description.measures[0].dataType, "Double");
  assert.deepEqual(description.attributes.map((attribute) => [attribute.id, attribute.mandatory]), [["UNIT_MEASURE", true], ["NOTE", false]]);
  assert.equal(description.attributes[0].attachment, "series (AREA, SEX)");
  assert.equal(description.categories[0].id, "01DEM");
  assert.deepEqual(description.csvHeader, ["STRUCTURE", "STRUCTURE_ID", "ACTION", "SEX", "AREA", "FREQ", "TIME_PERIOD", "OBS_VALUE", "UNIT_MEASURE"]);
  assert.ok(csvHeader(description, true).includes("NOTE"));
  assert.equal(description.structureId, "TNSO:DF_01DI_IND_AGING(1.0)");
});

test("normalizeLabel removes punctuation, zero-width characters and case", () => {
  assert.equal(normalizeLabel("  จ.เชียง​ใหม่ "), "จ เชียงใหม่");
  assert.equal(normalizeLabel("Bangkok (Metropolis)"), "bangkok metropolis");
});

test("searchCodes ranks exact id, then exact name, then partial", () => {
  const codes = codesFromCodelist(DATAFLOW_FULL.data.codelists[0], "th");
  const result = searchCodes(codes, { search: "กรุงเทพมหานคร", limit: 10, offset: 0 });
  assert.equal(result.codes[0].id, "TH1");
  assert.equal(result.totalMatched, 2);
  assert.deepEqual(searchCodes(codes, { parent: "TH5", limit: 10, offset: 0 }).codes.map((code) => code.id), ["TH50"]);
});

test("matchValues: exact and prefix matches are matched, others need review", () => {
  const codes = codesFromCodelist(DATAFLOW_FULL.data.codelists[0], "th");
  const allowed = new Set(["TH", "TH1", "TH5", "TH50", "TH12", "_T"]);
  const results = matchValues(
    ["กรุงเทพมหานคร", "กรุงเทพมหานคร", "จังหวัดเชียงใหม่", "จ.นนทบุรี", "กทม.", "TH50", "เชียงไหม่", "จันทบุรี", "ดาวอังคาร", "", "ทั้งหมด"],
    codes,
    allowed,
  );
  const byInput = Object.fromEntries(results.map((result) => [result.input, result]));
  assert.equal(byInput["กรุงเทพมหานคร"].code, "TH1");
  assert.equal(byInput["กรุงเทพมหานคร"].occurrences, 2);
  assert.equal(byInput["จังหวัดเชียงใหม่"].code, "TH50");
  assert.equal(byInput["จ.นนทบุรี"].code, "TH12");
  assert.equal(byInput["กทม."].code, "TH1");
  assert.equal(byInput["TH50"].method, "id");
  assert.equal(byInput["เชียงไหม่"].status, "needs_review");
  assert.equal(byInput["เชียงไหม่"].candidates?.[0].code, "TH50");
  // จันทบุรี must not lose its leading จ to prefix stripping.
  assert.equal(byInput["จันทบุรี"].code, "TH22");
  assert.equal(byInput["จันทบุรี"].notAllowedByConstraint, true);
  assert.equal(byInput["ดาวอังคาร"].status, "unmatched");
  assert.equal(byInput[""].status, "blank");
  assert.equal(byInput["ทั้งหมด"].code, "_T");
});
