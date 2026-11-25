# fmr-sdmx-mcp

[English](README.md) | **ภาษาไทย**

MCP server ที่ติดตั้งและรันบนเครื่องของผู้ใช้ สำหรับทำงานกับ Fusion Metadata Registry (FMR) ของสำนักงานสถิติแห่งชาติ (สสช.)

- หน้าเว็บ FMR: `https://sdmx.nso.go.th/FusionMetadataRegistry/`
- SDMX v2 structure API (ใช้ค้นหาโครงสร้าง): `https://sdmx.nso.go.th/FusionMetadataRegistry/sdmx/v2/structure`
- SDMX v1 REST API (XML ดิบ): `https://sdmx.nso.go.th/FusionMetadataRegistry/ws/public/sdmxapi/rest`
- API ตรวจสอบข้อมูลแบบ asynchronous: `https://sdmx.nso.go.th/FusionMetadataRegistry/ws/public/data`

ที่อยู่เดิม `https://fmr-sdmx.nso.go.th/fmr` ยังใช้งานได้ ถ้าต้องการใช้ต่อให้ตั้ง `FMR_BASE_URL` เป็นที่อยู่นั้น

เครื่องมือนี้ใช้สำหรับ:

- ค้นหา dataflow และอธิบายโครงสร้างของแต่ละ dataflow
- จับคู่ชื่อหรือข้อความกับรหัส (code)
- สร้างแม่แบบ SDMX-CSV
- ตรวจสอบไฟล์ข้อมูล และดาวน์โหลดผลที่แปลงเป็น SDMX แล้ว

โดยตั้งใจ **ไม่มีเครื่องมือเผยแพร่ (publish)** และไม่แก้ไข structural metadata ใด ๆ

ความรู้พื้นฐานเกี่ยวกับ FMR: [docs/FMR_KNOWLEDGE.md](docs/FMR_KNOWLEDGE.md)

<a id="installation"></a>
## การติดตั้ง

ทำตามขั้นตอนด้านล่างเพื่อติดตั้งบนเครื่องของคุณเอง

- โปรแกรมนี้ทำงานบนเครื่องของคุณ โปรแกรม AI ที่ใช้จะเป็นตัวสั่งให้มันเริ่มทำงาน เช่น Claude Desktop, Claude Code, Codex, Antigravity หรือโปรแกรมอื่นที่รองรับ MCP
- ไม่มีการติดตั้งอะไรบนเซิร์ฟเวอร์ FMR

### 1. ตรวจสอบสิ่งที่ต้องมี

- **Node.js เวอร์ชัน 20.18.1 ขึ้นไป** ตรวจสอบด้วย `node --version` ถ้ายังไม่มีหรือเวอร์ชันเก่ากว่านี้ ให้ติดตั้งรุ่น LTS จาก <https://nodejs.org> หรือบน Windows ใช้คำสั่ง:

  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```

  ติดตั้งเสร็จแล้วให้ปิดแล้วเปิด terminal ใหม่ เพื่อให้เรียก `node` และ `npm` ได้
- **เข้าถึง `sdmx.nso.go.th` ได้** จะต่อตรงหรือผ่าน proxy ก็ได้ ดู `HTTPS_PROXY` ในหัวข้อ [การตั้งค่า](#configuration)
- **โปรแกรม AI ที่รองรับ MCP อย่างน้อยหนึ่งตัว** ได้แก่ Claude Desktop, Claude Code, OpenAI Codex หรือ Google Antigravity
- **Git** (ไม่บังคับ) ช่วยให้อัปเดตง่ายขึ้น ถ้าไม่มีก็ดาวน์โหลดเป็นไฟล์ ZIP แทนได้

### 2. ดาวน์โหลดโค้ด

- วางไว้ในโฟลเดอร์ที่จะไม่ย้ายไปไหน เพราะโปรแกรม AI จะรันจากตำแหน่งนี้
- แนะนำให้ใช้โฟลเดอร์ที่ไม่มีช่องว่างและไม่มีอักษรไทยในชื่อ จะได้ไม่มีปัญหาเรื่องการใส่เครื่องหมายคำพูด

```powershell
cd C:\tools          # หรือโฟลเดอร์อื่นที่ต้องการ
git clone https://github.com/nungsatick/fmr-sdmx-mcp.git
cd fmr-sdmx-mcp
```

ถ้าไม่มี Git:

1. เปิด repository บน GitHub แล้วเลือก **Code → Download ZIP**
2. แตกไฟล์ไว้ เช่นที่ `C:\tools\fmr-sdmx-mcp`
3. `cd` เข้าไปในโฟลเดอร์นั้น

### 3. ติดตั้ง dependencies และ build

```powershell
npm install
npm run build
```

- `npm install` ต้องรันทุกครั้งหลังดาวน์โหลดโค้ด เพราะ `node_modules` ไม่ได้อยู่ใน repository
- `npm run build` คอมไพล์ `src/` ไปเป็น `dist/` โดย `dist/index.js` คือไฟล์ที่โปรแกรม AI จะรัน

### 4. ทดสอบ (ไม่บังคับ แต่แนะนำ)

```powershell
npm test
```

test ทุกข้อควรผ่าน ชุดทดสอบนี้ใช้ FMR จำลอง จึงไม่ต้องต่ออินเทอร์เน็ต

ถ้าจะตรวจการเชื่อมต่อกับ FMR จริง ให้รันเซิร์ฟเวอร์เอง:

```powershell
node dist/index.js
```

ควรขึ้นข้อความ `fmr-sdmx-mcp 0.2.0 connected to https://sdmx.nso.go.th/FusionMetadataRegistry` แล้วโปรแกรมจะรอการเชื่อมต่อจากโปรแกรม AI กด `Ctrl+C` เพื่อหยุด

### 5. จด path สองรายการ

- **Path ของเซิร์ฟเวอร์** คือ path เต็มของ `dist\index.js` ดูได้ด้วยคำสั่ง:

  ```powershell
  (Resolve-Path dist\index.js).Path
  ```

- **โฟลเดอร์ข้อมูล** คือโฟลเดอร์ที่เก็บไฟล์ที่จะตรวจสอบหรือแปลง เช่น `C:\data\sdmx`
  - โฟลเดอร์นี้จะใช้เป็นค่า `FMR_ALLOWED_ROOTS`
  - เครื่องมือจะอ่านหรือเขียนไฟล์นอกโฟลเดอร์นี้ไม่ได้

### 6. เพิ่มเซิร์ฟเวอร์ในโปรแกรม AI

ทำตามหัวข้อของโปรแกรมที่ใช้ใน [ติดตั้งในโปรแกรม AI](#install-in-an-mcp-client) โดยใช้ path สองรายการจากขั้นที่ 5

### 7. ตรวจว่าใช้งานได้

เปิดโปรแกรม AI ใหม่ เริ่มแชตหรือ session ใหม่ แล้วพิมพ์:

> Run fmr_health

ผลที่ถูกต้อง:

- `structureApi` และ `dataApi` แสดง `"ok": true` ทั้งคู่
- `allowedRoots` มีโฟลเดอร์ข้อมูลของคุณ

จากนั้นลองสั่ง เช่น *"ค้นหา dataflow ใน FMR เรื่องผู้สูงอายุ"*

### การอัปเดต

```powershell
cd C:\tools\fmr-sdmx-mcp
git pull            # หรือดาวน์โหลด ZIP ใหม่แล้วแตกไฟล์ทับโฟลเดอร์เดิม
npm install
npm run build
```

เสร็จแล้วให้เปิดโปรแกรม AI ใหม่ ไม่ต้องแก้การตั้งค่าในโปรแกรม AI

### การถอนการติดตั้ง

1. ลบรายการ `fmr-sdmx-mcp` ออกจากโปรแกรม AI (ดูวิธีในหัวข้อของโปรแกรมนั้นด้านล่าง)
2. เปิดโปรแกรม AI ใหม่
3. ลบโฟลเดอร์ที่ติดตั้งไว้

### การแก้ปัญหา

| อาการ | วิธีแก้ |
| --- | --- |
| ขึ้นว่าไม่รู้จักคำสั่ง `node` | ติดตั้ง Node.js (ขั้นที่ 1) แล้วเปิด terminal ใหม่ หรือใส่ path เต็มของ `node.exe` ในการตั้งค่าของโปรแกรม AI |
| โปรแกรม AI แสดงว่าเซิร์ฟเวอร์ล้มเหลว หรือไม่เห็นเครื่องมือ | ตรวจ path ของ `dist/index.js` (ใน JSON ต้องเขียน `\` เป็น `\\` ทุกตัว) ตรวจว่า `npm run build` สำเร็จ แล้วปิดโปรแกรม AI ให้สนิทก่อนเปิดใหม่ |
| `fmr_health` แสดง `ok: false` หรือหมดเวลา (timeout) | ลองเปิด `https://sdmx.nso.go.th/FusionMetadataRegistry/` ในเบราว์เซอร์ ถ้าใช้เครือข่ายสำนักงาน ให้ใส่ `HTTPS_PROXY` ใน `env` ของโปรแกรม AI |
| "Path is outside FMR_ALLOWED_ROOTS" | เพิ่มโฟลเดอร์นั้นใน `FMR_ALLOWED_ROOTS` (หลายโฟลเดอร์คั่นด้วย `;`) แล้วเปิดโปรแกรม AI ใหม่ |
| "FMR has no dataset for uid …" | ไฟล์ที่อัปโหลดไว้ใน FMR หมดอายุแล้ว (ประมาณ 15 นาที) ให้ตรวจสอบไฟล์ใหม่อีกครั้ง |

## สำหรับนักพัฒนา

```powershell
npm install
npm test        # build แล้วรัน unit test และ integration test กับ FMR จำลอง
npm start       # รันเซิร์ฟเวอร์ผ่าน stdio (ปกติโปรแกรม AI เป็นผู้สั่งรัน)
```

ไฟล์ `mcp.json` ของ plugin สั่งรัน `dist/index.js` ผ่าน stdio

<a id="configuration"></a>
## การตั้งค่า

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `FMR_BASE_URL` | `https://sdmx.nso.go.th/FusionMetadataRegistry` | URL หลักของ FMR |
| `FMR_ALLOWED_ROOTS` | โฟลเดอร์ที่ plugin ทำงานอยู่ | โฟลเดอร์ (path เต็ม) ที่เครื่องมืออ่านหรือเขียนไฟล์ได้ หลายโฟลเดอร์คั่นด้วย `;` |
| `FMR_MAX_FILE_MB` | `100` | ขนาดไฟล์อัปโหลดสูงสุด (MB) |
| `FMR_TIMEOUT_SECONDS` | `60` | เวลารอสูงสุดของคำขอทั่วไปหนึ่งครั้ง |
| `FMR_UPLOAD_TIMEOUT_SECONDS` | `300` | เวลารอสูงสุดของการอัปโหลดและดาวน์โหลด |
| `FMR_RETRIES` | `2` | จำนวนครั้งที่ลองคำขอ GET ใหม่ เมื่อเครือข่ายขัดข้องหรือได้ 429, 502, 503, 504 |
| `FMR_CACHE_TTL_SECONDS` | `600` | ระยะเวลาเก็บ cache ของ dataflow, โครงสร้าง และ codelist (0 = ไม่เก็บ) |
| `FMR_SESSION_TTL_MINUTES` | `15` | เวลาที่ FMR เก็บไฟล์อัปโหลดไว้เมื่อไม่มีการใช้งาน (ใช้แสดงในข้อความแจ้ง) |
| `FMR_LANGUAGE` | `th` | ภาษาที่ต้องการสำหรับชื่อ (ถ้าไม่มีจะใช้ en แล้วจึงใช้ภาษาใดก็ได้ที่มี) |
| `FMR_PROXY` | ไม่ตั้ง | URL ของ proxy ถ้าไม่ตั้งจะใช้ `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` |
| `FMR_MAX_RESPONSE_CHARS` | `60000` | ความยาวสูงสุดของคำตอบจากเครื่องมือที่ส่งกลับให้โมเดล |
| `FMR_USERNAME` / `FMR_PASSWORD` | ไม่ตั้ง | ชื่อผู้ใช้และรหัสผ่าน HTTP Basic (ไม่บังคับ ต้องตั้งคู่กัน) |

- ตั้ง `FMR_ALLOWED_ROOTS` ให้ชี้ไปที่โฟลเดอร์ข้อมูลก่อนใช้งานไฟล์ในเครื่อง
- ชื่อผู้ใช้และรหัสผ่านต้องมาจาก environment ของเครื่อง ห้าม commit ลง repository

```powershell
$env:FMR_ALLOWED_ROOTS = 'C:\data\sdmx;C:\outputs\sdmx'
$env:HTTPS_PROXY = 'http://proxy.example.go.th:8080'   # เฉพาะเมื่อเครือข่ายต้องใช้ proxy
npm start
```

<a id="install-in-an-mcp-client"></a>
## ติดตั้งในโปรแกรม AI

เซิร์ฟเวอร์นี้เป็นโปรแกรม stdio ที่รันบนเครื่อง โปรแกรม AI ทุกตัวจะสั่งรัน `node <โฟลเดอร์>/dist/index.js` และส่งค่าตั้งค่าผ่าน environment variable ให้ทำ[การติดตั้ง](#installation)ขั้นที่ 1–5 ให้เสร็จก่อน

ในตัวอย่างด้านล่าง ให้แทนค่าต่อไปนี้:

- `C:\path\to\fmr-sdmx-mcp` ด้วยโฟลเดอร์ที่ติดตั้งไว้ (ขั้นที่ 2) ใน JSON ให้เขียน `\` เป็น `\\` ทุกตัว หรือใช้ `/` แทน
- `C:\data\sdmx` ด้วยโฟลเดอร์ข้อมูลของคุณ (`FMR_ALLOWED_ROOTS` หลายโฟลเดอร์คั่นด้วย `;`) เครื่องมือจะอ่านหรือเขียนไฟล์นอกโฟลเดอร์นี้ไม่ได้

ข้อควรทำ:

- ใช้ชื่อเซิร์ฟเวอร์ `fmr-sdmx-mcp` เหมือนกันในทุกโปรแกรม
- หลังแก้การตั้งค่า **ต้องเปิดโปรแกรม AI นั้นใหม่** เพื่อให้เริ่มรันเซิร์ฟเวอร์
- ตรวจว่าใช้งานได้โดยสั่งให้รัน `fmr_health`

> ถ้าโปรแกรม AI หา `node` ไม่เจอ ให้ใส่ path เต็มแทน เช่น `C:\\Program Files\\nodejs\\node.exe` บน Windows หรือผลจากคำสั่ง `which node` บน macOS/Linux

### Claude Code (CLI หรือแท็บ Code ของ Claude Desktop)

```powershell
claude mcp add --scope user fmr-sdmx-mcp `
  -e FMR_BASE_URL=https://sdmx.nso.go.th/FusionMetadataRegistry `
  -e "FMR_ALLOWED_ROOTS=C:\data\sdmx" `
  -e FMR_LANGUAGE=th `
  -- node "C:\path\to\fmr-sdmx-mcp\dist\index.js"

claude mcp get fmr-sdmx-mcp     # ควรแสดง: Status: ✔ Connected
```

- `--scope user` ทำให้ใช้ได้ทุกโปรเจกต์ ค่าจะเก็บไว้ใน `~/.claude.json`
- ถ้าจะใช้เฉพาะใน repository เดียวและแชร์ให้ทีม ให้ใช้ `--scope project` แทน ซึ่งจะเขียนไฟล์ `.mcp.json` ลงใน repository นั้น
- ลบออกได้ด้วย `claude mcp remove fmr-sdmx-mcp -s user`

### Claude Desktop (แท็บ Chat)

1. เปิด **Settings → Developer → Edit Config** จะเปิดไฟล์ `claude_desktop_config.json`
   - Windows: ปกติอยู่ที่ `%APPDATA%\Claude\claude_desktop_config.json` แต่บางเครื่องเก็บไว้ที่ `%LOCALAPPDATA%\Claude-Data\<profile>\` จึงควรเปิดผ่านเมนู
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
2. เพิ่มเซิร์ฟเวอร์ใต้ `mcpServers` โดยคงเซิร์ฟเวอร์อื่นที่มีอยู่แล้วไว้:

   ```json
   {
     "mcpServers": {
       "fmr-sdmx-mcp": {
         "command": "node",
         "args": ["C:\\path\\to\\fmr-sdmx-mcp\\dist\\index.js"],
         "env": {
           "FMR_BASE_URL": "https://sdmx.nso.go.th/FusionMetadataRegistry",
           "FMR_ALLOWED_ROOTS": "C:\\data\\sdmx",
           "FMR_LANGUAGE": "th"
         }
       }
     }
   }
   ```

3. ปิด Claude Desktop ให้สนิท โดยคลิกขวาที่ไอคอนใน system tray แล้วเลือก **Quit** (กดปิดหน้าต่างอย่างเดียวไม่พอ) แล้วเปิดใหม่
4. เครื่องมือจะแสดงในเมนูเครื่องมือหรือ connectors ของแชตใหม่

ข้อควรระวัง:

- คัดลอกตัวอย่างไปใช้ได้จาก [claude_desktop_config.snippet.json](claude_desktop_config.snippet.json)
- สำรองไฟล์ก่อนแก้ทุกครั้ง ถ้า JSON ผิดรูปแบบ เซิร์ฟเวอร์ทุกตัวในไฟล์จะโหลดไม่ขึ้น

### OpenAI Codex (CLI, IDE extension, แอปเดสก์ท็อป)

Codex ทุกรูปแบบอ่านการตั้งค่าจาก `~/.codex/config.toml` (บน Windows คือ `%USERPROFILE%\.codex\config.toml`) เพิ่มเซิร์ฟเวอร์ด้วย CLI ได้ดังนี้:

```powershell
codex mcp add fmr-sdmx-mcp `
  --env FMR_BASE_URL=https://sdmx.nso.go.th/FusionMetadataRegistry `
  --env "FMR_ALLOWED_ROOTS=C:\data\sdmx" `
  --env FMR_LANGUAGE=th `
  -- node "C:\path\to\fmr-sdmx-mcp\dist\index.js"

codex mcp list
```

หรือแก้ `config.toml` เอง ไฟล์นี้เป็นรูปแบบ **TOML ไม่ใช่ JSON**:

```toml
[mcp_servers.fmr-sdmx-mcp]
command = "node"
args = ['C:\path\to\fmr-sdmx-mcp\dist\index.js']
startup_timeout_sec = 30   # ไม่บังคับ; คำขอแรกไปยัง FMR อาจใช้เวลานาน

[mcp_servers.fmr-sdmx-mcp.env]
FMR_BASE_URL = "https://sdmx.nso.go.th/FusionMetadataRegistry"
FMR_ALLOWED_ROOTS = 'C:\data\sdmx'
FMR_LANGUAGE = "th"
```

- ข้อความใน TOML ที่ใช้เครื่องหมายคำพูดเดี่ยว (`'...'`) จะเก็บ `\` ของ path Windows ไว้ตามเดิม
- ถ้าไฟล์นี้ผิดรูปแบบ ทั้ง CLI และ IDE extension จะใช้งานไม่ได้
- ลบเซิร์ฟเวอร์ได้ด้วย `codex mcp remove fmr-sdmx-mcp`

### Google Antigravity

1. ที่แผง agent ด้านข้าง เปิดเมนู **…** → **MCP Servers** → **Manage MCP Servers** → **View raw config**
   - เวอร์ชันใหม่เปิดได้อีกทางที่ **Settings → Customizations** หรือพิมพ์ `/mcp` ในช่องพิมพ์คำสั่ง
   - จะเปิดไฟล์ `mcp_config.json` ซึ่งอยู่ที่:
     - เวอร์ชันล่าสุด: `~/.gemini/config/mcp_config.json`
     - เวอร์ชันก่อนหน้า: `~/.gemini/antigravity/mcp_config.json`
     - เฉพาะ workspace: `.agents/mcp_config.json`
2. เพิ่มเซิร์ฟเวอร์ รูปแบบเหมือน Claude Desktop:

   ```json
   {
     "mcpServers": {
       "fmr-sdmx-mcp": {
         "command": "node",
         "args": ["C:\\path\\to\\fmr-sdmx-mcp\\dist\\index.js"],
         "env": {
           "FMR_BASE_URL": "https://sdmx.nso.go.th/FusionMetadataRegistry",
           "FMR_ALLOWED_ROOTS": "C:\\data\\sdmx",
           "FMR_LANGUAGE": "th"
         }
       }
     }
   }
   ```

3. บันทึกไฟล์ แล้วกด **Refresh** ในหน้า Manage MCP Servers หรือเปิด Antigravity ใหม่

ค่าเพิ่มเติมที่ใส่ได้ (ไม่บังคับ):

- `"disabled": true` ปิดการใช้งานเซิร์ฟเวอร์ชั่วคราว
- `"disabledTools": [...]` ซ่อนเครื่องมือบางตัว

### โปรแกรมอื่น

ใช้ได้กับโปรแกรมใดก็ได้ที่รองรับ MCP แบบ stdio โดยตั้งค่าดังนี้:

- คำสั่ง: `node`
- argument: `<repo>/dist/index.js`
- environment variable: ตามหัวข้อ [การตั้งค่า](#configuration)

ข้อควรระวัง:

- ถ้าเครือข่ายต้องใช้ proxy ให้ใส่ `HTTPS_PROXY` หรือ `FMR_PROXY` ใน `env` เดียวกัน
- ห้ามใส่ `FMR_USERNAME` / `FMR_PASSWORD` ในไฟล์ตั้งค่าที่แชร์หรือ commit

## เครื่องมือ

ค้นหาและเตรียมข้อมูล (อ่านอย่างเดียว มี cache):

| เครื่องมือ | หน้าที่ |
| --- | --- |
| `fmr_health` | ตรวจ structure API และ data API แสดงค่า proxy, cache และโฟลเดอร์ที่อนุญาต |
| `fmr_list_dataflows` | ค้นหา dataflow ด้วยภาษาไทยหรืออังกฤษ กรองตาม agency หรือหมวดหมู่ และคืน URN |
| `fmr_list_categories` | แสดงหมวดหมู่สถิติ (เช่น `CAT_STAT_SECT`) พร้อมจำนวน dataflow ในแต่ละหมวด |
| `fmr_describe_dataflow` | สรุปโครงสร้างเป็น JSON: dimension ตามลำดับ, codelist (เวอร์ชันตามที่ DSD อ้างถึง), time dimension, measure, attribute, constraint และ header ของ SDMX-CSV |
| `fmr_get_codes` | ค้นหารหัสใน codelist ที่ component ของ dataflow ใช้จริง (หรือ codelist ใดก็ได้) |
| `fmr_map_codes` | จับคู่ค่าในคอลัมน์ (เช่น ชื่อจังหวัดภาษาไทย) กับรหัส ค่าที่ไม่แน่ใจจะส่งให้คนตรวจ และเขียนไฟล์ CSV สำหรับตรวจได้ |
| `fmr_csv_template` | header ของ SDMX-CSV 2.0 และคำอธิบายแต่ละคอลัมน์ เขียนเป็นไฟล์ CSV ที่มีแค่ header ได้ |
| `fmr_get_structure` | artefact โครงสร้างแบบดิบ (SDMX-JSON v2 หรือ SDMX-ML 2.1) |

ตรวจสอบและแปลงข้อมูล (ไฟล์อยู่ใน FMR ชั่วคราว ไม่มีการเผยแพร่):

| เครื่องมือ | หน้าที่ |
| --- | --- |
| `fmr_validate` | อัปโหลด รอผล ระบุ `structure_refs` ให้ถ้าจำเป็น แล้วคืนสรุปข้อผิดพลาดแบบจัดกลุ่ม |
| `fmr_transform_data` | ทำแบบ `fmr_validate` แล้วดาวน์โหลดไฟล์ที่แปลงแล้ว พร้อมเขียน `<output>.validation.json` |
| `fmr_load_data`, `fmr_get_validation_status`, `fmr_revalidate`, `fmr_download` | ควบคุมทีละขั้นด้วยตัวเอง |

## พฤติกรรมที่ควรรู้

- ผลการตรวจสอบจะ **สรุปให้**: จัดกลุ่มข้อผิดพลาดตามประเภท × component พร้อมจำนวน ค่าที่พบบ่อย และตัวอย่าง key ส่วนรายงานฉบับเต็มของ FMR จะเขียนเป็นไฟล์ JSON
- ผลสรุป (verdict) มีดังนี้:
  - `clean` ไม่มีข้อผิดพลาด
  - `has_errors_but_convertible` มีข้อผิดพลาดแต่ยังแปลงได้
  - `blocked` แปลงไม่ได้ (PreventsConversion)
  - `structure_problem` ปัญหาโครงสร้าง (MissingDSD/IncorrectDSD/InvalidRef)
  - `unreadable` อ่านไฟล์ไม่ได้
  - `in_progress` กำลังตรวจ
- ไฟล์ที่อัปโหลดไว้ใน FMR จะหมดอายุเมื่อไม่มีการใช้งานประมาณ 15 นาที
  - ถ้า uid ไม่มีอยู่หรือหมดอายุ เครื่องมือจะแจ้งข้อผิดพลาดที่ชัดเจนทันที
  - FMR เองตอบ uid แบบนี้ด้วย HTTP 200 พร้อมข้อความ error
- MCP เก็บ session cookie ของ FMR แยกตาม uid ไว้ในหน่วยความจำ คำขอดูสถานะและดาวน์โหลดจึงไปถึง session เดียวกันบนเซิร์ฟเวอร์
- `structure_refs` ต้องมี URN ที่ตรวจสอบแล้วหนึ่งรายการต่อหนึ่ง dataset ในไฟล์ URN ต้องได้จาก `fmr_list_dataflows` / `fmr_describe_dataflow` ห้ามเดา
- codelist แต่ละเวอร์ชันมีรหัสไม่เหมือนกัน
  - ตัวอย่าง: DSD อาจใช้ `CL_AREA(1.6)` ขณะที่เวอร์ชันล่าสุดคือ `1.8`
  - เมื่อระบุ dataflow แล้ว `fmr_get_codes` และ `fmr_map_codes` จะใช้เวอร์ชันที่ DSD อ้างถึง
- จะไม่เขียนทับไฟล์ผลลัพธ์ เว้นแต่ระบุ `overwrite=true`
- ค่าสังเกต (observation) ที่ว่างคือค่าที่ขาดหาย ไม่ใช่ศูนย์
- การแปลงข้อมูลไม่ใช่การเผยแพร่

## บันทึกการเปลี่ยนแปลง

### ยังไม่ออกเวอร์ชัน

- ค่าเริ่มต้นของ `FMR_BASE_URL` เปลี่ยนเป็นที่อยู่ใหม่ของ สสช. `https://sdmx.nso.go.th/FusionMetadataRegistry` (เดิม `https://fmr-sdmx.nso.go.th/fmr`) เครื่องที่ตั้ง `FMR_BASE_URL` ไว้เองต้องแก้เป็นค่าใหม่
- เพิ่มคู่มือติดตั้งสำหรับ Claude Code, Claude Desktop, Codex และ Antigravity และ README ภาษาไทย

### 0.2.0

**เครื่องมือใหม่**

- `fmr_list_categories`, `fmr_describe_dataflow`, `fmr_get_codes`, `fmr_map_codes`, `fmr_csv_template`, `fmr_validate`

**ประสิทธิภาพและเครือข่าย**

- การค้นหาใช้ SDMX v2 JSON API แบบ stubs พร้อม cache ในหน่วยความจำ (เดิมรายการ dataflow เป็น XML ขนาด 1.26 MB ทุกครั้งที่เรียก)
- มี timeout ของคำขอ, ลองคำขอ GET ใหม่แบบ backoff และรองรับ proxy (`HTTPS_PROXY`, `FMR_PROXY`)

**การตรวจสอบข้อมูล**

- สรุปผลการตรวจสอบแบบจัดกลุ่ม และบันทึกรายงานฉบับเต็มเป็นไฟล์
- แจ้งข้อผิดพลาดทันทีเมื่อ uid ไม่มีอยู่หรือหมดอายุ แทนการรอจน timeout
- รองรับ `structure_refs` (หนึ่ง URN ต่อหนึ่ง dataset) และตรวจซ้ำได้ทั้งกรณี `IncorrectDSD` / `InvalidRef` และ `MissingDSD`

**ความปลอดภัยของไฟล์**

- ตรวจขนาดไฟล์ก่อนอ่าน และสร้างโฟลเดอร์ผลลัพธ์ให้
- ไม่เขียนทับไฟล์โดยไม่แจ้ง และเตือนเมื่อนามสกุลไฟล์ไม่ตรง

**อื่น ๆ**

- ใช้ชื่อภาษาไทยก่อน ถ้าไม่มีจะใช้ภาษาอื่นแทน
- เพิ่ม annotation ให้เครื่องมือ และจำกัดขนาดคำตอบ
- test รันได้ทุกระบบปฏิบัติการ รวมถึงชุดทดสอบกับเซิร์ฟเวอร์ FMR จำลอง
