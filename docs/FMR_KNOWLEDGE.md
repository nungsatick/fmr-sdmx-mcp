# สรุปความรู้ Fusion Metadata Registry (FMR) สำหรับ fmr-sdmx-mcp

> สรุปจาก https://www.sdmx.io/software/fmr/ และ https://fmrwiki.sdmx.io/latest/ (ณ 25 พ.ย. 2569)
> เทียบกับโค้ดใน `src/` ของโปรเจกต์นี้

---

## 1. FMR คืออะไร

- **Fusion Metadata Registry (FMR)** คือ SDMX registry สำหรับเก็บ structural metadata (codelist, concept scheme, DSD, dataflow ฯลฯ) ให้เป็น "แหล่งความจริงเดียว" ขององค์กรสถิติ
- พัฒนาและเป็นเจ้าของโดย **Bank for International Settlements (BIS)** ภายใต้โครงการ BIS Open Tech
- License: เว็บแอปใช้ Public License Agreement, source code ใช้ Apache 2.0 (ใช้ฟรี)
- เวอร์ชันปัจจุบัน: **FMR 12** (12.4.x, 12.5.0) รองรับ SDMX 2.0 / 2.1 / 3.0 และ EDI
  - FMR 10 = SDMX 2.1 registry spec, FMR 11+ = SDMX 3.0 information model
  - ⚠️ FMR 12.5.0 เปลี่ยน database schema แบบย้อนกลับไม่ได้ ต้อง backup ก่อน migrate
- Deploy: Docker (`sdmxio/fmr`, `sdmxio/fmr-mysql`), Docker Compose, WAR บน Tomcat; DB = MySQL/MariaDB/Oracle/SQL Server
- ผลิตภัณฑ์ในตระกูลเดียวกัน: Fusion Workbench, Fusion Metadata Service (FMS, publish structure เป็น REST API), Data Microservice (validate/convert/map data), FusionXL (Excel plugin), sdmx-core (Java library)

## 2. ความสามารถหลัก

| กลุ่ม | รายละเอียด |
|---|---|
| Metadata repository | สร้าง/แก้/versioning (semantic versioning SDMX 3.1), changelog, time-travel query (`asOf`) |
| Data validation | ตรวจ dataset กับ DSD, constraint, validation scheme |
| Data transformation (mapping) | แปลงข้อมูลจาก DSD หนึ่งไปอีก DSD ด้วย Structure Map / Representation Map |
| Data conversion | แปลงระหว่าง SDMX-ML, SDMX-JSON, SDMX-CSV, EDI (Excel ต้องเป็น layout ของ FMR) |
| Reporting templates | สร้าง Excel Reporting Template ให้ผู้ส่งข้อมูลกรอก |
| Security | OIDC (Keycloak, Entra ID, Auth0), AD, LDAP, X509, Basic (root), RBAC |

## 3. กระบวนการ Data Validation (3 ขั้น)

1. **Syntax Validation** — รูปแบบไฟล์ถูกต้องไหม (XML, Excel layout ฯลฯ)
2. **Duplicates** — รวม series/observation ที่ซ้ำ; ถ้าซ้ำแต่ค่าขัดกันจะรายงานเป็น error
3. **Syntax Agnostic Validation** — ตรวจเนื้อหาด้วย Validation Engines:
   - **Structure** — มีทุก dimension, ไม่มี dimension/attribute เกิน
   - **Representation** — ค่าตรงกับ codelist / data type ใน DSD
   - **Mandatory Attributes** — attribute บังคับครบ
   - **Constraints** — ไม่ใช้ค่าที่ Content Constraint ห้าม
   - **Mathematical Rules** — ตาม Validation Scheme (เช่น ผลรวมย่อย = ยอดรวม)
   - **Frequency Match** — FREQ ตรงกับรูปแบบ TIME_PERIOD (A → YYYY)
   - **Obs Status Match** — OBS_STATUS สอดคล้องกับค่า (missing ต้องไม่มีค่า)
   - **Missing Time Period** — ไม่มีช่วงเวลาขาดหายใน series

ประเภท error ที่เห็นในรายงาน: `Constraint`, `Representation`, `FormatSpecific` ฯลฯ แต่ละรายการมี message, dataset index, component, ค่า, ตำแหน่ง (Dataset/Series/Observation/Group) และ key

- `PreventsConversion` / `PreventsPublication` = ความรุนแรงของ error (admin ตั้งค่าได้) — แปลงได้ไม่ได้แปลว่าข้อมูลถูกต้องครบ
- Header `Prior-Data-Dependent` ปิด validator "Mandatory Observations" และ "Valid Calculations"

## 4. Asynchronous Data Validation & Transformation Web Service (ที่ MCP ใช้)

ฐาน: `{FMR}/ws/public/data/...` (public โดย default, ตั้งเป็น private ได้)

| Endpoint | Method | สาระ |
|---|---|---|
| `/load` | POST | multipart field `uploadFile` หรือ body ตรง; รับ CSV, XLSX, SDMX-ML, EDI, zip → คืน `uid` |
| `/loadStatus?uid=` | GET | รายงานการตรวจ (JSON) |
| `/revalidate` | POST JSON | `{ "UID": "...", "SRef": ["urn...", ...] }` — **URN หนึ่งตัวต่อหนึ่ง dataset ในไฟล์** (DSD / Dataflow / Provision Agreement) |
| `/download` | GET | `uid`, `datasetIndex`, `map` (URN ปลายทาง ต้องมี Structure Map), `zip`, `includeMetrics`, `unmapped`; รูปแบบกำหนดด้วย Accept header |
| `/publish` | POST JSON | `UID`, `Action` (Append/Replace/Delete), `DeleteAction`, `Dataset` — **MCP นี้ไม่ใส่โดยตั้งใจ** |

สถานะ loadStatus:
- กำลังทำ: `Initialising`, `Analysing`, `Validating`, `Consolidating`
- จบ: `Complete`, `IncorrectDSD`, `InvalidRef`, `MissingDSD`, `Error`

บริการอื่นที่เกี่ยวข้อง: Data Validation Web Service (`/ws/public/data/validate`, synchronous), Data Transformation Web Service (synchronous, header `Map-Structure`), Explain Plan, Data Reporting Template Web Services, Publication Table Web Services

> เอกสารไม่ได้ระบุเรื่อง session cookie และอายุ token — ข้อมูล "หมดอายุ ~15 นาที / ต้องใช้ cookie เดิม" ใน README มาจากการทดลองกับเซิร์ฟเวอร์ NSO ควรทดสอบยืนยัน

## 5. Structure Query REST API

- SDMX v2: `/sdmx/v2/structure/{type}/{agency}/{id}/{version}[/{itemID}]?detail=&references=&asOf=`
- SDMX v1 (legacy, ที่ MCP ใช้อยู่): `/ws/public/sdmxapi/rest/{type}/{agency}/{id}/{version}?references=`
- Wildcard: `*` (ทุกค่า), `~` (version default/ล่าสุด), `+` (latest stable); หลายค่าคั่นด้วย `,`
- `detail`: `full`, `allstubs`, `referencestubs`, `allcompletestubs`, `referencecompletestubs`, `referencepartial`, `raw` — **ใช้ stubs เพื่อลดขนาด payload**
- `references`: `none`, `parents`, `parentsandsiblings`, `ancestors`, `children`, `descendants`, `all` หรือชื่อ type
- Accept: `application/vnd.sdmx.structure+json;version=2.0.0`, `application/vnd.sdmx.structure+xml;version=3.0.0` (และ 2.1)
- `Accept-Language` เลือกภาษาของชื่อ (เช่น `th`, `en`)

## 6. Authentication

- Public paths `/sdmx/v1/**`, `/sdmx/v2/**` (ไม่ผ่าน Valve) — ทรัพยากรที่จำกัดสิทธิ์จะได้ 401
- Secure: `/ws/secure/sdmxapi/rest`
- วิธี: OIDC Bearer token (client credentials), Basic (AD/LDAP/root), X509, Valve/ticket (CAS/ECAS, FMR 12.3+), หรือ login ที่ `/login.html` แล้วใช้ session cookie ซ้ำ

## 7. Data formats (Accept header)

| รูปแบบ | Accept |
|---|---|
| SDMX-CSV 2.0 (แนะนำ) | `application/vnd.sdmx.data+csv;version=2.0.0;labels=[id\|name\|both];timeFormat=[original\|normalized];keys=[none\|obs\|series\|both]` |
| SDMX-CSV 1.0 | `application/vnd.sdmx.data+csv;version=1.0.0` |
| SDMX-JSON | `application/vnd.sdmx.data+json;version=2.0.0` / `1.0.0` |
| SDMX-ML Structure Specific | `application/vnd.sdmx.structurespecificdata+xml;version=3.0` / `2.1` / `2.0` |
| SDMX-ML Generic | `application/vnd.sdmx.genericdata+xml;version=2.1` |
| SDMX-EDI | `application/vnd.sdmx.data+edi` |
| Excel Reporting Template | `application/vnd.reporttemplate` (+ `.AGENCY:ID(ver)`, `;DATA_PROVIDER=X`, `+partial`) |

### โครงสร้าง SDMX-CSV
- **2.0:** `STRUCTURE, STRUCTURE_ID, ACTION, <dimensions...>, TIME_PERIOD, OBS_VALUE, <attributes...>`
  - `STRUCTURE` = `dataflow` / `datastructure` / `dataprovision`, `STRUCTURE_ID` = `AGENCY:ID(VERSION)` เช่น `TNSO:DF_X(1.0)`, `ACTION` = `I` ฯลฯ
- **1.0:** `DATAFLOW, <dimensions...>, TIME_PERIOD, OBS_VALUE, ...` (ไม่มี STRUCTURE/ACTION)
- ชื่อคอลัมน์ = Component ID ใน DSD, ลำดับคอลัมน์ไม่สำคัญ
- labels=both: header `ID:Name`, ค่า `ID: Label`
- ไฟล์ที่ระบุโครงสร้างในตัวเองแบบนี้ **ไม่ต้อง revalidate** — CSV/XLSX ทั่วไปต้องให้ `structure_ref`

รูปแบบที่ FMR **ไม่รับ**: Fusion CSV, Time Series CSV, RDF/Turtle

## 8. แนวคิดหลักใน SDMX ที่ต้องรู้เวลาทำข้อมูล

- **Data Provider** → **Provision Agreement (PA)** เชื่อม Dataflow กับผู้ส่งข้อมูล
- **Dataflow** อ้างถึง **DSD** ซึ่งกำหนด dimensions, attributes, measure, time dimension
- **Codelist** = รายการรหัสที่ใช้ได้, **Content Constraint** = จำกัดค่าที่อนุญาตเพิ่มเติม
- **URN** รูปแบบ `urn:sdmx:org.sdmx.infomodel.datastructure.Dataflow=AGENCY:ID(VERSION)`
- **Structure Map / Representation Map** ใช้แปลงข้อมูลข้าม DSD หรือแปลงรหัส

## 9. ข้อสังเกตจากเซิร์ฟเวอร์ NSO จริง (ตรวจผ่านเบราว์เซอร์ 25 พ.ย. 2569)

- มี **960 dataflows** (TNSO 956, IAEG-SDGs 4) ชื่อเกือบทั้งหมดเป็นภาษาไทย (`th`) มีภาษาอังกฤษแค่ 2 รายการ
- `GET .../ws/public/sdmxapi/rest/dataflow/all/all/latest` (XML) มีขนาด **1.26 MB** ส่วน `GET .../sdmx/v2/structure/dataflow/*/*/~?detail=allstubs` (JSON) มีขนาด 470 KB
- Accept `application/vnd.sdmx.structure+json;version=1.0` ที่ v1 API ได้ **406** ให้ใช้ JSON ผ่าน v2 API แทน
- `/ws/public/productinfo` ได้ 404 (ไม่ได้เปิดใช้)
- `loadStatus` เมื่อ uid ไม่มีอยู่หรือหมดอายุ ตอบ **HTTP 200** พร้อม `{"Error":["No Dataset details found for UID: ..."],"Status":500}`
- **เวอร์ชัน codelist ต้องตามที่ DSD อ้างถึง** เช่น `DSD_01DI_IND_AGING` ใช้ `CL_AREA(1.6)` (42 รหัส) ขณะที่เวอร์ชันล่าสุดคือ `1.8` (45 รหัส)
- DSD ตัวอย่างมี dimensions `POP_IND, SEX, AREA, CWT, UNIT_MUL, UNIT, FREQ` + `TIME_PERIOD`, measure `OBS_VALUE` (Double), attributes `NOTE`, `SOURCE` (optional)
- รหัสพิเศษใน codelist: `_T` รวม, `_O` อื่นๆ, `_U` ไม่ระบุ/ไม่ทราบ, `_Z` ไม่เข้าข่าย
- Category scheme `TNSO:CAT_STAT_SECT` มี 21 สาขา (01DEM ประชากร … 21ENV สิ่งแวดล้อม) ตรงกับเลขนำหน้า dataflow id เช่น `DF_01DI_...`

## 10. การปรับปรุง MCP (เวอร์ชัน 0.2.0)

ดู README.md หัวข้อ Changelog: เพิ่มเครื่องมือ describe/codes/map/template/validate/categories, cache, timeout/retry/proxy, สรุปผล validation แบบจัดกลุ่ม, fail-fast เมื่อ uid หมดอายุ, รองรับหลาย structure_refs, ความปลอดภัยของไฟล์ และ test ที่รันได้ทุก OS

## 11. แหล่งอ้างอิง

- https://www.sdmx.io/software/fmr/
- https://fmrwiki.sdmx.io/latest/
- Async Web Service: https://fmrwiki.sdmx.io/latest/rest-api/data-processing/AsynchronousDataValidationAndTransformationWebService/
- Data Validation glossary: https://fmrwiki.sdmx.io/latest/information-model/glossary/DataValidation
- Structure query v2: https://fmrwiki.sdmx.io/latest/rest-api/structural-metadata/SDMXV2QueryStructuresWebService/
- Data formats: https://fmrwiki.sdmx.io/latest/formats/data/DataFormats/
- SDMX-CSV: https://fmrwiki.sdmx.io/latest/formats/data/SdmxCsvData/
- REST auth: https://fmrwiki.sdmx.io/latest/rest-api/authentication/rest-api-authentication/
