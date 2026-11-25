import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { clientFromEnvironment } from "./fmr-client.js";
import { createServer, VERSION } from "./server.js";
try {
    const client = clientFromEnvironment();
    const server = createServer(client);
    await server.connect(new StdioServerTransport());
    console.error(`fmr-sdmx-mcp ${VERSION} connected to ${client.baseUrl}${client.http.proxy ? ` via proxy ${client.http.proxy}` : ""}`);
}
catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
//# sourceMappingURL=index.js.map