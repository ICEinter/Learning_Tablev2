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
  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    "--window-size=1440,960",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { detached: true, stdio: "ignore" });

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        if (res.ok) {
          const info = await res.json();
          wsUrl = info.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/login?mode=demo`, { method: "PUT" });
    const pageTarget = await newPageRes.json();
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

    await send("Page.enable");
    await send("Runtime.enable");

    async function capture(outName) {
      const snap = await send("Page.captureScreenshot", { format: "png" });
      if (snap.result && snap.result.data) {
        const filePath = path.join(ARTIFACT_DIR, outName);
        fs.writeFileSync(filePath, Buffer.from(snap.result.data, "base64"));
        console.log(`Saved screenshot: ${outName}`);
      }
    }

    await sleep(2000);
    // Login as Admin
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const adminBtn = btns.find(b => b.textContent && b.textContent.includes('เข้าสู่ระบบในฐานะ Admin'));
          if (adminBtn) adminBtn.click();
        })()
      `,
    });
    await sleep(3000);

    // Go to /admin/solve
    await send("Page.navigate", { url: "http://localhost:3000/admin/solve" });
    await sleep(3000);

    // Click "โหลดข้อมูลจริง: วท.ระยอง 2/2569" (accepting confirm)
    console.log("Loading Rayong dataset...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          window.confirm = () => true;
          const btns = Array.from(document.querySelectorAll('button'));
          const btn = btns.find(b => b.textContent && b.textContent.includes('โหลดข้อมูลจริง'));
          if (btn) btn.click();
        })()
      `,
    });
    await sleep(2000);

    // Select Heuristic or Tabu
    console.log("Selecting Heuristic algorithm...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const cards = Array.from(document.querySelectorAll('div, button'));
          const hCard = cards.find(el => el.textContent && el.textContent.includes('Greedy Heuristic (MRV)'));
          if (hCard) hCard.click();
        })()
      `,
    });
    await sleep(1000);

    // Click "เริ่มคำนวณตาราง"
    console.log("Starting calculation...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const runBtn = btns.find(b => b.textContent && b.textContent.includes('เริ่มคำนวณ'));
          if (runBtn) runBtn.click();
        })()
      `,
    });
    await sleep(3500);

    // Capture the solved result panel
    await capture("09_solved_result_panel.png");

    // Click "บันทึกตารางร่างนี้"
    console.log("Saving timetable...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const saveBtn = btns.find(b => b.textContent && b.textContent.includes('บันทึกตารางร่างนี้'));
          if (saveBtn) saveBtn.click();
        })()
      `,
    });
    await sleep(2000);

    // Click "เปิดดูตารางร่างที่บันทึกแล้ว"
    console.log("Opening saved timetable...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const links = Array.from(document.querySelectorAll('a, button'));
          const openLink = links.find(el => el.textContent && el.textContent.includes('เปิดดูตารางร่างที่บันทึกแล้ว'));
          if (openLink) openLink.click();
        })()
      `,
    });
    await sleep(3500);

    // Capture the timetable grid view!
    await capture("10_timetable_grid_rayong.png");

    ws.close();
    console.log("Done!");
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
