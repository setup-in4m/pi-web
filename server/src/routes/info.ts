import { Router } from "express";
import { execSync } from "node:child_process";
import { agentDir, IS_WIN, IS_MAC } from "../config.js";

const router = Router();

router.get("/info", (_req, res) => {
  res.json({
    agentDir,
    platform: process.platform,
    piVersion: piVersion(),
  });
});

export default router;

function piVersion(): string {
  try {
    return (
      execSync("pi --version", {
        encoding: "utf-8",
        timeout: 3000,
        shell: true as any,
        stdio: ["pipe", "pipe", "pipe"] as any,
      })?.trim() || "0.x"
    );
  } catch {
    return "0.x";
  }
}
