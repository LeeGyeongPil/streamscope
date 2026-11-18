// Typed re-export of the mock server for tests.
import type { Server } from "node:http";
import { createMockServer as create } from "../../scripts/mock-server.mjs";

export const createMockServer = create as () => Server;
export const FORMATS = ["openai-chat", "openai-compat", "openai-responses", "anthropic", "gemini", "ai-sdk-ui"];
