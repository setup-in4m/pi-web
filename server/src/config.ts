import { getAgentDir, AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export const PORT = parseInt(process.env.PI_WEB_PORT || "3456", 10);
export const IS_WIN = process.platform === "win32";
export const IS_MAC = process.platform === "darwin";

export const agentDir = getAgentDir();
export const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
export const modelRegistry = ModelRegistry.create(authStorage, join(agentDir, "models.json"));
