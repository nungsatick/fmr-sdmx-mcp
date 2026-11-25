import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type FmrClient } from "./fmr-client.js";
export declare const VERSION = "0.2.0";
export declare function createServer(client: FmrClient): McpServer;
