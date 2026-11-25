type J = any;
export type Names = Record<string, string>;
export interface ArtefactRef {
    agency: string;
    id: string;
    version: string;
}
export declare const URN_CLASS: {
    readonly dataflow: "datastructure.Dataflow";
    readonly datastructure: "datastructure.DataStructure";
    readonly codelist: "codelist.Codelist";
    readonly provisionagreement: "registry.ProvisionAgreement";
    readonly conceptscheme: "conceptscheme.ConceptScheme";
    readonly categoryscheme: "categoryscheme.CategoryScheme";
};
export declare function urnFor(kind: keyof typeof URN_CLASS, ref: ArtefactRef): string;
export interface ParsedUrn extends ArtefactRef {
    className: string;
    item?: string;
}
export declare function parseUrn(urn: string): ParsedUrn | undefined;
export declare function refKey(ref: ArtefactRef): string;
export declare function pickName(names: Names | undefined, language: string): string | undefined;
export interface DataflowSummary extends ArtefactRef {
    urn: string;
    name?: string;
    names?: Names;
    description?: string;
}
export declare function dataflowSummaries(message: J, language: string): DataflowSummary[];
export interface CategoryInfo {
    scheme: string;
    id: string;
    name?: string;
    parent?: string;
}
export declare function categoriesFromSchemes(message: J, language: string): CategoryInfo[];
/** Map of dataflow key "AG:ID(VER)" -> category ids. */
export declare function categorisationIndex(message: J): Map<string, string[]>;
export interface CodelistInfo extends ArtefactRef {
    urn: string;
    name?: string;
    codeCount?: number;
}
export interface ComponentInfo {
    id: string;
    name?: string;
    concept?: string;
    codelist?: CodelistInfo;
    dataType?: string;
}
export interface DimensionInfo extends ComponentInfo {
    position: number;
    /** Codes allowed by content constraints, when constrained. */
    allowedCodes?: string[];
    allowedCodeCount?: number;
}
export interface AttributeInfo extends ComponentInfo {
    mandatory: boolean;
    attachment: string;
    allowedCodes?: string[];
    allowedCodeCount?: number;
}
export interface DataflowDescription extends ArtefactRef {
    urn: string;
    name?: string;
    description?: string;
    structure?: ArtefactRef & {
        urn: string;
        name?: string;
    };
    categories: CategoryInfo[];
    dimensions: DimensionInfo[];
    timeDimension?: ComponentInfo;
    measures: ComponentInfo[];
    attributes: AttributeInfo[];
    constraints: {
        id: string;
        role?: string;
        constrainedComponents: string[];
    }[];
    /** SDMX-CSV 2.0 header with mandatory attributes. */
    csvHeader: string[];
    structureId: string;
}
export declare function describeDataflowMessage(message: J, target: Partial<ArtefactRef> | undefined, language: string): DataflowDescription;
export interface CodeInfo {
    id: string;
    name?: string;
    names?: Names;
    parent?: string;
}
export declare function codesFromCodelist(codelist: J, language: string): CodeInfo[];
export declare function findCodelist(message: J, ref?: ArtefactRef): J | undefined;
/** Lowercase, NFC, without zero-width characters and punctuation; single spaces. */
export declare function normalizeLabel(value: string): string;
export declare function similarity(a: string, b: string): number;
export interface CodeSearchResult {
    totalMatched: number;
    codes: CodeInfo[];
}
export declare function searchCodes(codes: CodeInfo[], options: {
    search?: string;
    parent?: string;
    limit: number;
    offset: number;
}): CodeSearchResult;
export interface MatchCandidate {
    code: string;
    name?: string;
    confidence: number;
    method: string;
    allowed?: boolean;
}
export interface CodeMatch {
    input: string;
    occurrences: number;
    status: "matched" | "ambiguous" | "needs_review" | "unmatched" | "blank";
    code?: string;
    name?: string;
    confidence?: number;
    method?: string;
    candidates?: MatchCandidate[];
    notAllowedByConstraint?: boolean;
}
/**
 * Match free-text values (labels or codes) to codes. Only exact or
 * normalised matches are marked "matched"; everything else must be reviewed
 * by a person before it is used.
 */
export declare function matchValues(values: string[], codes: CodeInfo[], allowed?: Set<string>): CodeMatch[];
export declare function csvHeader(description: DataflowDescription, includeOptionalAttributes: boolean): string[];
export interface CsvColumnGuide {
    column: string;
    role: "structure" | "dimension" | "time" | "measure" | "attribute";
    required: boolean;
    name?: string;
    codelist?: string;
    codeCount?: number;
    allowedCodeCount?: number;
    dataType?: string;
    value?: string;
    note?: string;
}
export declare function csvColumnGuide(description: DataflowDescription, includeOptionalAttributes: boolean): CsvColumnGuide[];
export declare function csvLine(values: string[]): string;
export {};
