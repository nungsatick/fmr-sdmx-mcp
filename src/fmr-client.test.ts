import test from "node:test";
import assert from "node:assert/strict";
import { FmrClient, isTerminalStatus, parseDataflows } from "./fmr-client.js";

test("parseDataflows extracts namespaced SDMX dataflows", () => {
  const xml = `<?xml version="1.0"?>
  <mes:Structure xmlns:mes="urn:sdmx:org.sdmx.infomodel.message:2.1" xmlns:str="urn:sdmx:org.sdmx.infomodel.structure:2.1" xmlns:com="urn:sdmx:org.sdmx.infomodel.common:2.1">
    <mes:Structures><str:Dataflows><str:Dataflow agencyID="TNSO" id="DF_TEST" version="1.0"><com:Name xml:lang="en">Test flow</com:Name></str:Dataflow></str:Dataflows></mes:Structures>
  </mes:Structure>`;
  assert.deepEqual(parseDataflows(xml), [{ agency: "TNSO", id: "DF_TEST", version: "1.0", name: "Test flow", description: undefined }]);
});

test("terminal status recognition", () => {
  assert.equal(isTerminalStatus("Complete"), true);
  assert.equal(isTerminalStatus("MissingDSD"), true);
  assert.equal(isTerminalStatus("Validating"), false);
});

test("path guard blocks files outside configured roots", async () => {
  const client = new FmrClient({ allowedRoots: [process.cwd()] });
  await assert.rejects(() => client.loadData("C:\\Windows\\win.ini"), /outside FMR_ALLOWED_ROOTS/);
});
