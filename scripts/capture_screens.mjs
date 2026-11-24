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
  console.log("Starting headless Chrome on port", PORT);

  const chromeProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_PROFILE}`,
    "--window-size=1440,920",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], {
    detached: true,
    stdio: "ignore",
  });

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

    if (!wsUrl) throw new Error("Could not connect to Chrome");

    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/login?mode=demo`, { method: "PUT" });
    const pageTarget = await newPageRes.json();
    const pageWsUrl = pageTarget.webSocketDebuggerUrl;

    const ws = new WebSocket(pageWsUrl);
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

    // Wait for login demo page to load
    await sleep(2500);

    // Click "เข้าสู่ระบบในฐานะ Admin" button
    console.log("Clicking เข้าสู่ระบบในฐานะ Admin...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const adminBtn = btns.find(b => b.textContent && b.textContent.includes('เข้าสู่ระบบในฐานะ Admin'));
          if (adminBtn) adminBtn.click();
        })()
      `,
    });

    // Wait for redirect to /admin
    await sleep(3500);
    await capture("01_admin_dashboard.png");

    // Navigate to /admin/solve
    console.log("Navigating to /admin/solve...");
    await send("Page.navigate", { url: "http://localhost:3000/admin/solve" });
    await sleep(3500);
    await capture("02_admin_solve_cards.png");

    // Scroll down on solve page to show parameters and buttons
    await send("Runtime.evaluate", { expression: "window.scrollBy(0, 500);" });
    await sleep(1000);
    await capture("03_admin_solve_params.png");

    // Click on "เปรียบเทียบ 3 อัลกอริทึม" tab
    console.log("Clicking Compare Tab...");
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const compareBtn = btns.find(b => b.textContent && b.textContent.includes('เปรียบเทียบ 3 อัลกอริทึม'));
          if (compareBtn) compareBtn.click();
        })()
      `,
    });
    await sleep(2000);
    await capture("04_compare_tab.png");

    // Navigate to /admin/timetables
    console.log("Navigating to /admin/timetables...");
    await send("Page.navigate", { url: "http://localhost:3000/admin/timetables" });
    await sleep(3000);
    await capture("05_timetables_list.png");

    // Navigate to /admin/data
    console.log("Navigating to /admin/data...");
    await send("Page.navigate", { url: "http://localhost:3000/admin/data" });
    await sleep(3000);
    await capture("06_master_data.png");

    // Navigate to /admin/reports
    console.log("Navigating to /admin/reports...");
    await send("Page.navigate", { url: "http://localhost:3000/admin/reports" });
    await sleep(3000);
    await capture("07_reports.png");

    // Navigate to /login?mode=demo and log in as Teacher
    console.log("Switching to Teacher login...");
    await send("Page.navigate", { url: "http://localhost:3000/login?mode=demo" });
    await sleep(2500);
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const teacherBtn = btns.find(b => b.textContent && b.textContent.includes('เข้าสู่ระบบในฐานะ ครู'));
          if (teacherBtn) teacherBtn.click();
        })()
      `,
    });
    await sleep(3500);
    await capture("08_teacher_schedule.png");

    ws.close();
    console.log("Done capturing all screenshots!");
  } finally {
    try {
      chromeProc.kill();
    } catch {}
  }
}

main().catch(console.error);
