import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_DIR = "C:\\Users\\Pc\\.gemini\\antigravity\\brain\\bd50cb12-ac25-485d-afa2-8e339f39904b";
const TEMP_PROFILE = "C:\\Users\\Pc\\Desktop\\lerning_tableV2\\.chrome-temp";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json`);
  const targets = await newPageRes.json();
  const pageTarget = targets.find((t) => t.url.includes("localhost:3000/admin/solve")) || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      cb(data);
    }
  };

  function send(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve) => {
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Click "บันทึกเป็นฉบับร่าง"
  console.log("Clicking บันทึกเป็นฉบับร่าง...");
  await send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const saveBtn = btns.find(b => b.textContent && b.textContent.includes('บันทึกเป็นฉบับร่าง'));
        if (saveBtn) saveBtn.click();
      })()
    `,
  });
  await sleep(1500);

  // Navigate to /admin/timetables
  console.log("Navigating to /admin/timetables...");
  await send("Page.navigate", { url: "http://localhost:3000/admin/timetables" });
  await sleep(2500);

  // Click the first timetable to open detail view
  console.log("Clicking the first timetable in list...");
  await send("Runtime.evaluate", {
    expression: `
      (() => {
        const row = document.querySelector('tbody tr');
        if (row) row.click();
        else {
          const link = document.querySelector('a[href^="/admin/timetables/"]');
          if (link) link.click();
        }
      })()
    `,
  });
  await sleep(3500);

  // Capture the timetable detail view
  const snap = await send("Page.captureScreenshot", { format: "png" });
  if (snap.result && snap.result.data) {
    fs.writeFileSync(path.join(ARTIFACT_DIR, "11_timetable_detail_rayong.png"), Buffer.from(snap.result.data, "base64"));
    console.log("Saved 11_timetable_detail_rayong.png");
  }

  ws.close();
  console.log("Done!");
}

main().catch(console.error);
