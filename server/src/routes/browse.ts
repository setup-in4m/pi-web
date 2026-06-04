import { Router } from "express";
import { execSync, execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IS_WIN, IS_MAC } from "../config.js";

const router = Router();

router.post("/browse-folder", async (_req, res) => {
  try {
    const path = await pickFolder();
    if (path) {
      res.json({ cancelled: false, path });
    } else {
      res.json({ cancelled: true });
    }
  } catch (e: any) {
    res.json({ cancelled: true, error: e.message });
  }
});

export default router;

async function pickFolder(): Promise<string | null> {
  if (IS_WIN) {
    return pickFolderWindows();
  }
  if (IS_MAC) {
    return pickFolderMac();
  }
  return pickFolderLinux();
}

function pickFolderWindows(): string | null {
  // Use a temp .ps1 script to avoid quoting hell with execSync
  const scriptPath = join(tmpdir(), `pi-web-picker-${Date.now()}.ps1`);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'Select project folder'
$d.ShowNewFolderButton = $true
$result = $d.ShowDialog()
if ($result -eq 'OK') {
  Write-Output $d.SelectedPath
}
`.trim();

  try {
    writeFileSync(scriptPath, script, "utf-8");
    const output = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { encoding: "utf-8", timeout: 60000 } as any
    ).trim();
    return output || null;
  } catch {
    return null;
  } finally {
    try { unlinkSync(scriptPath); } catch {}
  }
}

function pickFolderMac(): string | null {
  try {
    return (
      execSync(
        `osascript -e 'POSIX path of (choose folder with prompt "Select project folder")'`,
        { encoding: "utf-8", timeout: 60000 }
      ).trim() || null
    );
  } catch {
    return null;
  }
}

function pickFolderLinux(): string | null {
  try {
    return (
      execSync(
        `zenity --file-selection --directory --title="Select project folder" 2>/dev/null || kdialog --getexistingdirectory`,
        { encoding: "utf-8", timeout: 60000, shell: true as any }
      ).trim() || null
    );
  } catch {
    return null;
  }
}
