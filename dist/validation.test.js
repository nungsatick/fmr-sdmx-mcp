import test from "node:test";
import assert from "node:assert/strict";
import { errorEnvelope, isTerminalStatus, summarizeValidation } from "./validation.js";
import { REPORT_WITH_ERRORS } from "./test-fixtures.js";
test("terminal status recognition", () => {
    assert.equal(isTerminalStatus("Complete"), true);
    assert.equal(isTerminalStatus("MissingDSD"), true);
    assert.equal(isTerminalStatus("Validating"), false);
    assert.equal(isTerminalStatus(500), false);
});
test("errorEnvelope detects FMR's unknown-uid answer", () => {
    assert.match(errorEnvelope({ Error: ["No Dataset details found for UID: x"], Status: 500 }) ?? "", /No Dataset details/);
    assert.equal(errorEnvelope({ Status: "Validating" }), undefined);
    assert.equal(errorEnvelope({ Status: "Error", Errors: true, Error: "unreadable" }), undefined);
});
test("summarizeValidation groups errors by type and component", () => {
    const summary = summarizeValidation(REPORT_WITH_ERRORS);
    assert.equal(summary.verdict, "has_errors_but_convertible");
    assert.equal(summary.totalErrors, 4);
    assert.equal(summary.preventsPublication, true);
    const [first, second] = summary.datasets[0].issueGroups;
    assert.equal(first.type, "Representation");
    assert.equal(first.componentId, "AREA");
    assert.equal(first.count, 3);
    assert.deepEqual(first.topValues, [{ value: "BKK", count: 2 }, { value: "CNX", count: 1 }]);
    assert.equal(first.sampleMessages.length, 2);
    assert.equal(second.type, "Constraint");
    assert.equal(summary.datasets[0].observations, 40);
});
test("summarizeValidation verdicts", () => {
    assert.equal(summarizeValidation({ Status: "Complete", Errors: false, Datasets: [{}] }).verdict, "clean");
    assert.equal(summarizeValidation({ Status: "Complete", Errors: true, PreventsConversion: true }).verdict, "blocked");
    assert.equal(summarizeValidation({ Status: "MissingDSD" }).verdict, "structure_problem");
    assert.equal(summarizeValidation({ Status: "Error", Error: "bad" }).verdict, "unreadable");
    assert.equal(summarizeValidation({ Status: "Validating" }).verdict, "in_progress");
    assert.match(summarizeValidation({ Status: "MissingDSD" }).hint ?? "", /structure_refs/);
});
//# sourceMappingURL=validation.test.js.map