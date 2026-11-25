/* Parsing of SDMX-JSON 2.0 structure messages returned by the FMR
 * `/sdmx/v2/structure/...` API, plus code search, code matching and
 * SDMX-CSV template helpers. The JSON is loosely typed on purpose: FMR
 * versions differ slightly, so every accessor is defensive. */
export const URN_CLASS = {
    dataflow: "datastructure.Dataflow",
    datastructure: "datastructure.DataStructure",
    codelist: "codelist.Codelist",
    provisionagreement: "registry.ProvisionAgreement",
    conceptscheme: "conceptscheme.ConceptScheme",
    categoryscheme: "categoryscheme.CategoryScheme",
};
export function urnFor(kind, ref) {
    return `urn:sdmx:org.sdmx.infomodel.${URN_CLASS[kind]}=${ref.agency}:${ref.id}(${ref.version})`;
}
export function parseUrn(urn) {
    const match = /^urn:sdmx:org\.sdmx\.infomodel\.([\w.]+)=([^:=]+):([^(:]+)\(([^)]+)\)(?:\.(.+))?$/.exec(urn.trim());
    if (!match)
        return undefined;
    return { className: match[1], agency: match[2], id: match[3], version: match[4], item: match[5] };
}
export function refKey(ref) {
    return `${ref.agency}:${ref.id}(${ref.version})`;
}
function asArray(value) {
    if (value === undefined || value === null)
        return [];
    return Array.isArray(value) ? value : [value];
}
function namesOf(node, field = "names") {
    const value = node?.[field];
    if (value && typeof value === "object" && !Array.isArray(value))
        return value;
    const single = node?.[field === "names" ? "name" : "description"];
    if (typeof single === "string")
        return { und: single };
    return undefined;
}
export function pickName(names, language) {
    if (!names)
        return undefined;
    return names[language] ?? names.en ?? names.th ?? Object.values(names)[0];
}
function refOf(node) {
    return { agency: String(node?.agencyID ?? node?.agency ?? ""), id: String(node?.id ?? ""), version: String(node?.version ?? "1.0") };
}
function sameRef(a, b) {
    return a.agency === b.agency && a.id === b.id && a.version === b.version;
}
function data(message) {
    return (message?.data ?? message ?? {});
}
export function dataflowSummaries(message, language) {
    const unique = new Map();
    for (const node of asArray(data(message).dataflows)) {
        const ref = refOf(node);
        if (!ref.agency || !ref.id)
            continue;
        const names = namesOf(node);
        unique.set(refKey(ref), {
            ...ref,
            urn: urnFor("dataflow", ref),
            name: pickName(names, language),
            names,
            description: pickName(namesOf(node, "descriptions"), language),
        });
    }
    return [...unique.values()];
}
export function categoriesFromSchemes(message, language) {
    const output = [];
    const walk = (scheme, nodes, parent) => {
        for (const node of nodes) {
            output.push({ scheme: refKey(scheme), id: String(node.id), name: pickName(namesOf(node), language), parent });
            walk(scheme, asArray(node.categories), String(node.id));
        }
    };
    for (const scheme of asArray(data(message).categorySchemes))
        walk(refOf(scheme), asArray(scheme.categories));
    return output;
}
/** Map of dataflow key "AG:ID(VER)" -> category ids. */
export function categorisationIndex(message) {
    const index = new Map();
    for (const node of asArray(data(message).categorisations)) {
        const source = typeof node.source === "string" ? parseUrn(node.source) : undefined;
        const target = typeof node.target === "string" ? parseUrn(node.target) : undefined;
        if (!source || !target?.item || !source.className.endsWith("Dataflow"))
            continue;
        const key = refKey(source);
        const list = index.get(key) ?? [];
        // Nested categories are dotted paths; keep the leaf id.
        const leaf = target.item.split(".").pop() ?? target.item;
        if (!list.includes(leaf))
            list.push(leaf);
        index.set(key, list);
    }
    return index;
}
function representation(node, codelists, language) {
    const rep = node?.localRepresentation ?? node?.representation ?? {};
    const enumeration = typeof rep.enumeration === "string" ? rep.enumeration : rep.enumeration?.urn;
    const dataType = rep.format?.dataType ?? rep.textFormat?.textType ?? rep.enumerationFormat?.dataType;
    if (!enumeration)
        return { dataType };
    const parsed = parseUrn(enumeration);
    if (!parsed)
        return { dataType };
    const codelist = codelists.get(refKey(parsed));
    return {
        dataType,
        codelist: {
            agency: parsed.agency,
            id: parsed.id,
            version: parsed.version,
            urn: enumeration,
            name: codelist ? pickName(namesOf(codelist), language) : undefined,
            codeCount: codelist ? asArray(codelist.codes).length : undefined,
        },
    };
}
function conceptName(node, concepts, language) {
    const urn = typeof node?.conceptIdentity === "string" ? node.conceptIdentity : node?.conceptIdentity?.urn;
    if (!urn)
        return {};
    const parsed = parseUrn(urn);
    const names = parsed?.item ? concepts.get(`${refKey(parsed)}.${parsed.item}`) : undefined;
    return { concept: urn, name: pickName(names, language) };
}
function constraintValues(region) {
    const output = new Map();
    for (const keyValue of [...asArray(region?.keyValues), ...asArray(region?.components)]) {
        const values = asArray(keyValue?.values).map((value) => (typeof value === "string" ? value : value?.value ?? value?.id))
            .filter((value) => typeof value === "string");
        if (keyValue?.id && values.length)
            output.set(String(keyValue.id), values);
    }
    return output;
}
export function describeDataflowMessage(message, target, language) {
    const d = data(message);
    const flows = asArray(d.dataflows);
    const flow = flows.find((node) => (!target?.agency || node.agencyID === target.agency)
        && (!target?.id || node.id === target.id)
        && (!target?.version || target.version === "~" || target.version === "latest" || target.version === "+" || node.version === target.version))
        ?? flows[0];
    if (!flow)
        throw new Error("FMR response did not contain the requested dataflow.");
    const flowRef = refOf(flow);
    const flowUrn = urnFor("dataflow", flowRef);
    const structureUrn = typeof flow.structure === "string" ? flow.structure : flow.structure?.urn;
    const structureRef = structureUrn ? parseUrn(structureUrn) : undefined;
    const dsds = asArray(d.dataStructures);
    const dsd = (structureRef && dsds.find((node) => sameRef(refOf(node), structureRef))) ?? (dsds.length === 1 ? dsds[0] : undefined);
    if (!dsd)
        throw new Error(`FMR response did not contain the data structure of ${refKey(flowRef)}. Query it with references=all.`);
    const codelists = new Map(asArray(d.codelists).map((node) => [refKey(refOf(node)), node]));
    const concepts = new Map();
    for (const scheme of asArray(d.conceptSchemes)) {
        for (const concept of asArray(scheme.concepts)) {
            const names = namesOf(concept);
            if (names)
                concepts.set(`${refKey(refOf(scheme))}.${concept.id}`, names);
        }
    }
    const components = dsd.dataStructureComponents ?? dsd.components ?? {};
    const dimensionNodes = asArray(components.dimensionList?.dimensions);
    const timeNode = components.dimensionList?.timeDimension ?? asArray(components.dimensionList?.timeDimensions)[0];
    // Allowed-value constraints attached to this dataflow or its DSD.
    const dsdRef = refOf(dsd);
    const allowed = new Map();
    const constraints = [];
    for (const constraint of [...asArray(d.dataConstraints), ...asArray(d.contentConstraints)]) {
        const role = constraint.role ?? constraint.type;
        if (role && !/allowed/i.test(String(role)))
            continue;
        const attachment = constraint.constraintAttachment ?? {};
        const attachedTo = [
            ...asArray(attachment.dataflows), ...asArray(attachment.dataStructures),
            ...asArray(attachment.dataflow), ...asArray(attachment.dataStructure),
        ].map((urn) => (typeof urn === "string" ? parseUrn(urn) : undefined)).filter(Boolean);
        const applies = attachedTo.length === 0 || attachedTo.some((ref) => sameRef(ref, flowRef) || sameRef(ref, dsdRef));
        if (!applies)
            continue;
        const constrained = [];
        for (const region of asArray(constraint.cubeRegions)) {
            if (region.include === false || region.isIncluded === false)
                continue;
            for (const [component, values] of constraintValues(region)) {
                const set = allowed.get(component) ?? new Set();
                values.forEach((value) => set.add(value));
                allowed.set(component, set);
                if (!constrained.includes(component))
                    constrained.push(component);
            }
        }
        constraints.push({ id: refKey(refOf(constraint)), role: role ? String(role) : undefined, constrainedComponents: constrained });
    }
    const allowedFields = (id) => {
        const set = allowed.get(id);
        if (!set)
            return {};
        const list = [...set];
        return { allowedCodes: list, allowedCodeCount: list.length };
    };
    const dimensions = dimensionNodes.map((node, index) => ({
        position: Number(node.position ?? index + 1),
        id: String(node.id),
        ...conceptName(node, concepts, language),
        ...representation(node, codelists, language),
        ...allowedFields(String(node.id)),
    })).sort((a, b) => a.position - b.position);
    const timeDimension = timeNode
        ? { id: String(timeNode.id ?? "TIME_PERIOD"), ...conceptName(timeNode, concepts, language), ...representation(timeNode, codelists, language) }
        : undefined;
    const measureNodes = [
        ...asArray(components.measureList?.measures),
        ...asArray(components.measureList?.primaryMeasure),
    ];
    const measures = measureNodes.map((node) => ({
        id: String(node.id),
        ...conceptName(node, concepts, language),
        ...representation(node, codelists, language),
    }));
    const attributes = asArray(components.attributeList?.attributes).map((node) => {
        const usage = String(node.usage ?? node.assignmentStatus ?? "optional");
        const relationship = node.attributeRelationship ?? {};
        let attachment = "dataset";
        if (relationship.observation !== undefined || relationship.primaryMeasure !== undefined)
            attachment = "observation";
        else if (asArray(relationship.dimensions).length)
            attachment = `series (${asArray(relationship.dimensions).join(", ")})`;
        else if (relationship.group !== undefined)
            attachment = `group (${relationship.group})`;
        else if (relationship.dataflow !== undefined)
            attachment = "dataflow";
        return {
            id: String(node.id),
            mandatory: /mandatory/i.test(usage),
            attachment,
            ...conceptName(node, concepts, language),
            ...representation(node, codelists, language),
            ...allowedFields(String(node.id)),
        };
    });
    const categoryIndex = categorisationIndex(message);
    const categoryNames = new Map(categoriesFromSchemes(message, language).map((category) => [category.id, category]));
    const categories = (categoryIndex.get(refKey(flowRef)) ?? []).map((id) => categoryNames.get(id) ?? { scheme: "", id });
    const description = {
        ...flowRef,
        urn: flowUrn,
        name: pickName(namesOf(flow), language),
        description: pickName(namesOf(flow, "descriptions"), language),
        structure: { ...dsdRef, urn: urnFor("datastructure", dsdRef), name: pickName(namesOf(dsd), language) },
        categories,
        dimensions,
        timeDimension,
        measures,
        attributes,
        constraints,
        csvHeader: [],
        structureId: refKey(flowRef),
    };
    description.csvHeader = csvHeader(description, false);
    return description;
}
export function codesFromCodelist(codelist, language) {
    return asArray(codelist?.codes).map((code) => {
        const names = namesOf(code);
        let parent = typeof code.parent === "string" ? code.parent : code.parent?.id;
        if (parent?.startsWith("urn:"))
            parent = parent.split(".").pop();
        return { id: String(code.id), name: pickName(names, language), names, parent: parent || undefined };
    });
}
export function findCodelist(message, ref) {
    const lists = asArray(data(message).codelists);
    if (!ref)
        return lists[0];
    return lists.find((node) => sameRef(refOf(node), ref))
        ?? (ref.version === "~" || ref.version === "latest" ? lists.find((node) => node.agencyID === ref.agency && node.id === ref.id) : undefined);
}
const ZERO_WIDTH = /[​-‍﻿]/g;
const PUNCTUATION = /[.,;:()[\]{}"'`“”‘’\-–—_/\\|*+!?]+/g;
/** Lowercase, NFC, without zero-width characters and punctuation; single spaces. */
export function normalizeLabel(value) {
    return value.normalize("NFC").replace(ZERO_WIDTH, "").toLowerCase()
        .replace(PUNCTUATION, " ").replace(/\s+/g, " ").trim();
}
const PREFIX_WORDS = ["จังหวัด", "อำเภอ", "ตำบล", "เขต", "แขวง", "เพศ", "ภาค", "จ", "อ", "ต", "province", "changwat"];
const ALIASES = {
    "กทม": "กรุงเทพมหานคร",
    "กรุงเทพ": "กรุงเทพมหานคร",
    "กรุงเทพฯ": "กรุงเทพมหานคร",
    "bangkok": "กรุงเทพมหานคร",
    "ทั้งหมด": "รวม",
    "ยอดรวม": "รวม",
    "ทั่วประเทศ": "ทั่วราชอาณาจักร",
    "ไม่ทราบ": "ไม่ระบุ/ไม่ทราบ/ไม่มีข้อมูล",
    "ไม่ระบุ": "ไม่ระบุ/ไม่ทราบ/ไม่มีข้อมูล",
};
function compact(value) {
    return normalizeLabel(value).replace(/ /g, "");
}
function stripPrefix(value) {
    const normal = normalizeLabel(value);
    const words = normal.split(" ");
    if (words.length > 1 && PREFIX_WORDS.includes(words[0]))
        return words.slice(1).join("");
    for (const prefix of PREFIX_WORDS) {
        // Only multi-character prefixes are stripped without a separator,
        // so names that merely start with จ/อ/ต (e.g. จันทบุรี) are untouched.
        if (prefix.length > 2 && normal.startsWith(prefix) && normal.length > prefix.length) {
            return normal.slice(prefix.length).replace(/ /g, "");
        }
    }
    return normal.replace(/ /g, "");
}
export function similarity(a, b) {
    if (a === b)
        return 1;
    if (!a.length || !b.length)
        return 0;
    const previous = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1)
        previous[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const temp = previous[j];
            previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
            diagonal = temp;
        }
    }
    return 1 - previous[b.length] / Math.max(a.length, b.length);
}
export function searchCodes(codes, options) {
    let pool = codes;
    if (options.parent !== undefined)
        pool = pool.filter((code) => (code.parent ?? "") === options.parent);
    const query = options.search?.trim();
    if (!query) {
        return { totalMatched: pool.length, codes: pool.slice(options.offset, options.offset + options.limit) };
    }
    const q = compact(query);
    const ranked = [];
    for (const code of pool) {
        const id = code.id.toLowerCase();
        const labels = Object.values(code.names ?? {}).map(compact);
        let rank = -1;
        if (id === query.toLowerCase())
            rank = 0;
        else if (labels.includes(q))
            rank = 1;
        else if (id.startsWith(query.toLowerCase()) || labels.some((label) => label.startsWith(q)))
            rank = 2;
        else if (id.includes(query.toLowerCase()) || labels.some((label) => label.includes(q)))
            rank = 3;
        if (rank >= 0)
            ranked.push({ code, rank });
    }
    ranked.sort((a, b) => a.rank - b.rank);
    return {
        totalMatched: ranked.length,
        codes: ranked.slice(options.offset, options.offset + options.limit).map((entry) => entry.code),
    };
}
function scoreCode(input, code) {
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === code.id.toLowerCase())
        return { code: code.id, confidence: 1, method: "id" };
    const labels = Object.values(code.names ?? {});
    if (labels.some((label) => label.trim() === trimmed))
        return { code: code.id, confidence: 1, method: "name" };
    const inputCompact = compact(trimmed);
    const aliased = ALIASES[inputCompact] ? compact(ALIASES[inputCompact]) : undefined;
    const inputStripped = stripPrefix(trimmed);
    let best;
    const consider = (confidence, method) => {
        if (!best || confidence > best.confidence)
            best = { code: code.id, confidence, method };
    };
    for (const label of labels) {
        const labelCompact = compact(label);
        const labelStripped = stripPrefix(label);
        if (!labelCompact)
            continue;
        if (labelCompact === inputCompact)
            consider(0.97, "normalized");
        if (aliased && labelCompact === aliased)
            consider(0.95, "alias");
        if (labelStripped === inputStripped || labelCompact === inputStripped || labelStripped === inputCompact)
            consider(0.93, "prefix");
        const shorter = Math.min(labelCompact.length, inputStripped.length);
        const longer = Math.max(labelCompact.length, inputStripped.length);
        if (shorter >= 2 && (labelCompact.includes(inputStripped) || inputStripped.includes(labelCompact))) {
            consider(0.55 + 0.3 * (shorter / longer), "contains");
        }
        const ratio = Math.max(similarity(inputStripped, labelStripped), similarity(inputCompact, labelCompact));
        if (ratio >= 0.75)
            consider(Number((ratio * 0.9).toFixed(3)), "fuzzy");
    }
    return best;
}
/**
 * Match free-text values (labels or codes) to codes. Only exact or
 * normalised matches are marked "matched"; everything else must be reviewed
 * by a person before it is used.
 */
export function matchValues(values, codes, allowed) {
    const counts = new Map();
    for (const value of values)
        counts.set(value, (counts.get(value) ?? 0) + 1);
    const byId = new Map(codes.map((code) => [code.id, code]));
    const results = [];
    for (const [input, occurrences] of counts) {
        if (input.trim() === "") {
            results.push({ input, occurrences, status: "blank" });
            continue;
        }
        const candidates = [];
        for (const code of codes) {
            const scored = scoreCode(input, code);
            if (!scored)
                continue;
            if (allowed) {
                scored.allowed = allowed.has(code.id);
                if (!scored.allowed)
                    scored.confidence = Number(Math.max(0, scored.confidence - 0.05).toFixed(3));
            }
            scored.name = code.name;
            candidates.push(scored);
        }
        candidates.sort((a, b) => b.confidence - a.confidence);
        const top = candidates[0];
        if (!top) {
            results.push({ input, occurrences, status: "unmatched" });
            continue;
        }
        const second = candidates[1];
        const tie = second !== undefined && top.confidence - second.confidence < 0.02;
        let status = "needs_review";
        if (top.confidence >= 0.93)
            status = tie ? "ambiguous" : "matched";
        results.push({
            input,
            occurrences,
            status,
            code: status === "matched" ? top.code : undefined,
            name: status === "matched" ? byId.get(top.code)?.name : undefined,
            confidence: top.confidence,
            method: top.method,
            candidates: status === "matched" && top.confidence === 1 ? undefined : candidates.slice(0, 3),
            notAllowedByConstraint: allowed && status === "matched" && !allowed.has(top.code) ? true : undefined,
        });
    }
    return results;
}
// ---------------------------------------------------------------- SDMX-CSV
export function csvHeader(description, includeOptionalAttributes) {
    const header = ["STRUCTURE", "STRUCTURE_ID", "ACTION", ...description.dimensions.map((dimension) => dimension.id)];
    if (description.timeDimension)
        header.push(description.timeDimension.id);
    header.push(...description.measures.map((measure) => measure.id));
    header.push(...description.attributes.filter((attribute) => attribute.mandatory || includeOptionalAttributes).map((attribute) => attribute.id));
    return header;
}
export function csvColumnGuide(description, includeOptionalAttributes) {
    const guide = [
        { column: "STRUCTURE", role: "structure", required: true, value: "dataflow" },
        { column: "STRUCTURE_ID", role: "structure", required: true, value: description.structureId },
        { column: "ACTION", role: "structure", required: true, value: "I", note: "SDMX-CSV 2.0 action: I = Information, A = Append, R = Replace, D = Delete. This MCP never publishes." },
    ];
    for (const dimension of description.dimensions) {
        guide.push({
            column: dimension.id,
            role: "dimension",
            required: true,
            name: dimension.name,
            codelist: dimension.codelist ? refKey(dimension.codelist) : undefined,
            codeCount: dimension.codelist?.codeCount,
            allowedCodeCount: dimension.allowedCodeCount,
            dataType: dimension.dataType,
        });
    }
    if (description.timeDimension) {
        guide.push({ column: description.timeDimension.id, role: "time", required: true, name: description.timeDimension.name, note: "SDMX time format, e.g. 2024 (A), 2024-Q1 (Q), 2024-01 (M); must agree with FREQ." });
    }
    for (const measure of description.measures) {
        guide.push({ column: measure.id, role: "measure", required: true, name: measure.name, dataType: measure.dataType, note: "Leave blank for a missing value; never write 0 for missing." });
    }
    for (const attribute of description.attributes) {
        if (!attribute.mandatory && !includeOptionalAttributes)
            continue;
        guide.push({
            column: attribute.id,
            role: "attribute",
            required: attribute.mandatory,
            name: attribute.name,
            codelist: attribute.codelist ? refKey(attribute.codelist) : undefined,
            codeCount: attribute.codelist?.codeCount,
            dataType: attribute.dataType,
            note: `attached at ${attribute.attachment}`,
        });
    }
    return guide;
}
function csvCell(value) {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
export function csvLine(values) {
    return values.map(csvCell).join(",");
}
//# sourceMappingURL=structure.js.map