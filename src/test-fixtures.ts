/* Fixtures shaped like real responses of fmr-sdmx.nso.go.th (SDMX-JSON 2.0). */

export const CS_URN = "urn:sdmx:org.sdmx.infomodel.conceptscheme.Concept=TNSO:CS_COMMON(1.0)";

export const DATAFLOW_STUBS = {
  data: {
    dataflows: [
      { id: "DF_01DI_IND_AGING", agencyID: "TNSO", version: "1.0", names: { th: "ชุดข้อมูลดัชนีการสูงอายุ" } },
      { id: "DF_02DI_WRK_NUM_REHAB", agencyID: "TNSO", version: "1.0", names: { th: "ชุดข้อมูลจำนวนการให้บริการฟื้นฟูสมรรถภาพคนงาน" } },
      { id: "DF_SDG_GLC", agencyID: "IAEG-SDGs", version: "1.16", names: { th: "ชุดข้อมูลเป้าหมายการพัฒนาที่ยั่งยืน" } },
    ],
  },
};

export const CATEGORY_SCHEMES = {
  data: {
    categorySchemes: [{
      id: "CAT_STAT_SECT", agencyID: "TNSO", version: "1.0", names: { th: "สาขาสถิติ" },
      categories: [
        { id: "01DEM", names: { th: "ประชากรศาสตร์ ประชากรและเคหะ" } },
        { id: "02LAB", names: { th: "แรงงาน" } },
      ],
    }],
  },
};

export const CATEGORISATIONS = {
  data: {
    categorisations: [
      {
        id: "CAT1", agencyID: "TNSO", version: "1.0",
        source: "urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_01DI_IND_AGING(1.0)",
        target: "urn:sdmx:org.sdmx.infomodel.categoryscheme.Category=TNSO:CAT_STAT_SECT(1.0).01DEM",
      },
      {
        id: "CAT2", agencyID: "TNSO", version: "1.0",
        source: "urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_02DI_WRK_NUM_REHAB(1.0)",
        target: "urn:sdmx:org.sdmx.infomodel.categoryscheme.Category=TNSO:CAT_STAT_SECT(1.0).02LAB",
      },
    ],
  },
};

const AREA_CODES_16 = [
  { id: "TH", names: { th: "ทั่วราชอาณาจักร" } },
  { id: "TH1", names: { th: "กรุงเทพมหานคร" } },
  { id: "TH101", names: { th: "กรุงเทพมหานครและปริมณฑล (ปริมณฑล ได้แก่ สมุทรปราการ ปทุมธานี นนทบุรี สมุทรสาคร นครปฐม)" } },
  { id: "TH5", names: { th: "ภาคเหนือ" }, parent: "TH" },
  { id: "TH50", names: { th: "เชียงใหม่" }, parent: "TH5" },
  { id: "TH22", names: { th: "จันทบุรี" } },
  { id: "TH12", names: { th: "นนทบุรี" } },
  { id: "_T", names: { th: "รวม" } },
];

export const CL_AREA_LATEST = {
  data: {
    codelists: [{
      id: "CL_AREA", agencyID: "TNSO", version: "1.8", names: { th: "รหัสพื้นที่" },
      codes: [...AREA_CODES_16, { id: "TH2X11", names: { th: "ภาคกลางส่วนกลาง" } }],
    }],
  },
};

export const DATAFLOW_FULL = {
  data: {
    dataflows: [{
      id: "DF_01DI_IND_AGING", agencyID: "TNSO", version: "1.0", names: { th: "ชุดข้อมูลดัชนีการสูงอายุ" },
      structure: "urn:sdmx:org.sdmx.infomodel.datastructure.DataStructure=TNSO:DSD_01DI_IND_AGING(1.0)",
    }],
    dataStructures: [{
      id: "DSD_01DI_IND_AGING", agencyID: "TNSO", version: "1.0", names: { th: "โครงสร้างดัชนีการสูงอายุ" },
      dataStructureComponents: {
        dimensionList: {
          id: "DimensionDescriptor",
          dimensions: [
            { id: "AREA", position: 2, conceptIdentity: `${CS_URN}.AREA`, localRepresentation: { enumeration: "urn:sdmx:org.sdmx.infomodel.codelist.Codelist=TNSO:CL_AREA(1.6)" } },
            { id: "SEX", position: 1, conceptIdentity: `${CS_URN}.SEX`, localRepresentation: { enumeration: "urn:sdmx:org.sdmx.infomodel.codelist.Codelist=TNSO:CL_SEX(1.0)" } },
            { id: "FREQ", position: 3, conceptIdentity: `${CS_URN}.FREQ`, localRepresentation: { enumeration: "urn:sdmx:org.sdmx.infomodel.codelist.Codelist=TNSO:CL_FREQ(1.0)" } },
          ],
          timeDimension: { id: "TIME_PERIOD", conceptIdentity: `${CS_URN}.TIME_PERIOD` },
        },
        attributeList: {
          attributes: [
            { id: "UNIT_MEASURE", usage: "mandatory", attributeRelationship: { dimensions: ["AREA", "SEX"] }, conceptIdentity: `${CS_URN}.UNIT_MEASURE` },
            { id: "NOTE", usage: "optional", attributeRelationship: { observation: {} }, conceptIdentity: `${CS_URN}.NOTE` },
          ],
        },
        measureList: { measures: [{ id: "OBS_VALUE", localRepresentation: { format: { dataType: "Double" } } }] },
      },
    }],
    codelists: [
      { id: "CL_AREA", agencyID: "TNSO", version: "1.6", names: { th: "รหัสพื้นที่" }, codes: AREA_CODES_16 },
      { id: "CL_SEX", agencyID: "TNSO", version: "1.0", names: { th: "เพศ" }, codes: [
        { id: "M", names: { th: "ชาย", en: "Male" } },
        { id: "F", names: { th: "หญิง", en: "Female" } },
        { id: "_T", names: { th: "รวม", en: "Total" } },
      ] },
      { id: "CL_FREQ", agencyID: "TNSO", version: "1.0", names: { th: "ความถี่" }, codes: [{ id: "A", names: { th: "รายปี" } }] },
    ],
    conceptSchemes: [{
      id: "CS_COMMON", agencyID: "TNSO", version: "1.0",
      concepts: [
        { id: "AREA", names: { th: "พื้นที่" } },
        { id: "SEX", names: { th: "เพศ" } },
        { id: "FREQ", names: { th: "ความถี่" } },
        { id: "TIME_PERIOD", names: { th: "ช่วงเวลา" } },
        { id: "UNIT_MEASURE", names: { th: "หน่วยวัด" } },
      ],
    }],
    dataConstraints: [{
      id: "CR_AGING", agencyID: "TNSO", version: "1.0", role: "Allowed",
      constraintAttachment: { dataflows: ["urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_01DI_IND_AGING(1.0)"] },
      cubeRegions: [{ include: true, keyValues: [{ id: "SEX", values: ["M", "F", "_T"] }, { id: "AREA", values: ["TH", "TH1", "TH5", "TH50", "TH12", "_T"] }] }],
    }],
    categorySchemes: CATEGORY_SCHEMES.data.categorySchemes,
    categorisations: [CATEGORISATIONS.data.categorisations[0]],
  },
};

export const REPORT_WITH_ERRORS = {
  Status: "Complete",
  Errors: true,
  FileFormat: "SDMX-CSV",
  PreventsConversion: false,
  PreventsPublication: true,
  Datasets: [{
    Dataflow: "urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=TNSO:DF_01DI_IND_AGING(1.0)",
    KeysCount: 10,
    ObsCount: 40,
    Errors: true,
    ValidationReport: [
      {
        Type: "Representation",
        Errors: [
          { Message: "Code 'BKK' not in CL_AREA", Dataset: 0, ComponentId: "AREA", ReportedValue: "BKK", Position: "Series", Keys: ["M:BKK:A"] },
          { Message: "Code 'BKK' not in CL_AREA", Dataset: 0, ComponentId: "AREA", ReportedValue: "BKK", Position: "Series", Keys: ["F:BKK:A"] },
          { Message: "Code 'CNX' not in CL_AREA", Dataset: 0, ComponentId: "AREA", ReportedValue: "CNX", Position: "Series", Keys: ["M:CNX:A"] },
        ],
      },
      {
        Type: "Constraint",
        Errors: [
          { Message: "TH22 not allowed", Dataset: 0, ComponentId: "AREA", ReportedValue: "TH22", Position: "Series", Keys: ["M:TH22:A"] },
        ],
      },
    ],
  }],
};
