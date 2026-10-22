// 데모 장면을 진짜 브라우저로 돌려 본다 — npm run demo:check (화면 그림까지: npm run demo:shots)
// 1) 빌라 샘플 글을 붙여 넣고 2) 뽑힌 근저당 9천만·소유자 한○○를 보고 3) 보증금 1억·시세 1억 5천만을 쳐서 4) '확인'을 누르면
// '선순위 9천만 + 보증금 1억 = 시세의 127% — 빨강'과 이유, 중개사에게 물어볼 질문이 떠야 한다. 화면은 demo/*.png 로 남긴다.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const CHROME = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, path.endsWith("/") ? path + "index.html" : path);
  try { const body = readFileSync(file); res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end("없음"); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const profile = mkdtempSync(join(tmpdir(), "deunggi-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", ...(process.env.CI ? ["--no-sandbox"] : []), "about:blank"], { stdio: "ignore" });

const fails = [], errors = [];
const ok = (cond, what) => { console.log(`${cond ? "  통과" : "  실패"}  ${what}`); if (!cond) fails.push(what); };
let ws, seq = 0;
const waiting = new Map();
const cdp = (method, params = {}) => new Promise((r, j) => { const id = ++seq; waiting.set(id, m => (m.error ? j(new Error(m.error.message)) : r(m.result))); ws.send(JSON.stringify({ id, method, params })); });
const js = async expr => { const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const until = async (expr, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr).catch(() => false)) return true; await sleep(100); } return false; };
// 누를 곳을 화면 가운데로 — 결과로 부드럽게 굴러가는 중이면 멈출 때까지 기다린 뒤 좌표를 잡는다(느린 CI 에서 빗나가지 않게)
const center = async sel => {
  const at = () => js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  let last = null;
  for (let i = 0; i < 30; i++) {
    await js(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'center', behavior:'instant'})`);
    await sleep(60);
    const p = await at();
    if (last && Math.abs(p.x - last.x) < 1 && Math.abs(p.y - last.y) < 1) return p;
    last = p;
  }
  return last;
};
const click = async sel => { const p = await center(sel); await sleep(80); for (const type of ["mousePressed", "mouseReleased"]) await cdp("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", clickCount: 1 }); };
const typeInto = async (sel, text) => { await click(sel); await cdp("Input.insertText", { text }); };
let view = { width: 1180, height: 900, mobile: false };
// 넓은 화면은 1배, 휴대폰은 2배로 찍는다 — 저장소가 그림으로 무거워지지 않게
const viewport = (width, height, mobile = false) => { view = { width, height, mobile }; return cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile }); };
// 긴 화면 한 장 — 창을 페이지 높이만큼 늘려 찍는다(위 막대·뒤 배경이 화면에 붙어 있어서 그냥 찍으면 중간에 끊긴다)
const SHOTS = process.argv.includes("--shots");   // 화면 그림은 npm run demo:shots 때만 새로 찍는다(돌릴 때마다 저장소가 무거워지지 않게)
const shot = async name => {
  if (!SHOTS) return;
  const { width, height, mobile } = view;
  await js("scrollTo(0,0)");
  const h = await js("Math.ceil(document.documentElement.scrollHeight)");
  await cdp("Emulation.setDeviceMetricsOverride", { width, height: Math.max(h, height), deviceScaleFactor: mobile ? 2 : 1, mobile });
  await sleep(250);
  const r = await cdp("Page.captureScreenshot", { format: "png" });
  await viewport(width, height, mobile);
  writeFileSync(join(root, "demo", name), Buffer.from(r.data, "base64"));
  console.log(`  저장   demo/${name}`);
};

try {
  let port;
  for (let i = 0; i < 100 && !port; i++) { try { port = readFileSync(join(profile, "DevToolsActivePort"), "utf-8").split("\n")[0]; } catch { await sleep(100); } }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value || a.description).join(" "));
  };
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
  await viewport(1180, 900);
  const scenarios = JSON.parse(readFileSync(join(root, "data/scenarios.json"), "utf-8")).scenarios;
  const villa = scenarios.find(s => s.id === "villa");

  console.log("데모 장면");
  await cdp("Page.navigate", { url: `${base}/app/` });
  ok(await until("document.documentElement.dataset.ready === '1'"), "화면이 뜬다");
  await shot("01-empty.png");
  await click("#reg");
  await cdp("Input.insertText", { text: villa.text });       // 붙여 넣기와 같은 길 — 글이 한 번에 들어온다
  ok(await until("!document.querySelector('#extract').hidden && document.querySelectorAll('#rights .right').length > 0"), "붙여 넣자마자 항목을 뽑는다");
  const rows = await js(`[...document.querySelectorAll('#rights .right')].map(r => [r.querySelector('select').value, r.querySelector('.amt').value, r.querySelector('.where').textContent])`);
  ok(rows.length === 1 && rows[0][0] === "mortgage" && rows[0][1] === "9천만" && /을구 1번/.test(rows[0][2]), `을구 근저당 채권최고액 9천만 — ${JSON.stringify(rows)}`);
  ok(await js("document.querySelector('#owner').value") === "한○○", "소유자 한○○");
  await typeInto("#deposit", "1억");
  await typeInto("#price", "1억 5천만");
  await typeInto("#counterparty", "한지민");
  ok(await js("document.querySelector('#priceRead').textContent") === "= 1억 5천만 원", "시세 칸 아래 읽은 값 '= 1억 5천만 원'");
  await shot("02-filled.png");
  await click("button.go");
  ok(await until("!!document.querySelector('.result .headline')"), "'확인'을 누르면 결과가 뜬다");
  const head = await js("document.querySelector('.result .headline').textContent.replace(/\\s+/g,' ').trim()");
  ok(head === "선순위 9천만 + 보증금 1억 = 시세의 127% — 빨강", `머리글 '${head}'`);
  ok(await js("document.querySelector('#verdict').textContent") === "위험", "전체 신호등 위험");
  const reason = await js("document.querySelector('.result .rows .row').textContent");
  ok(/경매로 넘어가면/.test(reason) && /을구 1번/.test(reason), "그 이유(쉬운 말)와 어느 줄 때문인지");
  const acts = await js("[...document.querySelectorAll('.actions li')].map(l => l.textContent.trim())");
  ok(acts.length >= 3 && acts.some(a => /물어보세요/.test(a)), `중개사에게 물어볼 질문 ${acts.length}개`);
  ok(await js("document.activeElement && document.activeElement.id") === "verdict", "결과로 초점이 옮겨 간다(화면 읽기 프로그램)");
  await js("scrollTo(0,0)");
  await shot("demo.png");

  console.log("결과 뒤에 칸을 고치면");
  await typeInto("#deposit", "0");
  ok(await until("!!document.querySelector('.result.old .oldnote')"), "옛 결과라고 표시하고 '확인'을 다시 누르라고 한다");
  await click("button.go");
  ok(await until("!document.querySelector('.result.old')"), "다시 누르면 새 결과");
  await js("document.querySelector('#deposit').value='1억'; document.querySelector('#deposit').dispatchEvent(new Event('input',{bubbles:true}))");
  await click("button.go");
  await until("!document.querySelector('.result.old')");

  console.log("용어 풀이");
  await click(".result .row .term");
  ok(await until("!document.querySelector('#result .pop').hidden"), "결과 속 용어를 누르면 뜻이 뜬다");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  ok(await until("document.querySelector('#result .pop').hidden"), "Esc 로 닫힌다");

  console.log("고친 칸은 지키기");
  await js("document.querySelector('#rights .amt').value='1억 2천만'; document.querySelector('#rights').dispatchEvent(new Event('input',{bubbles:true}))");
  await click("#reg");
  await cdp("Input.insertText", { text: "\n" });
  ok(await until("!document.querySelector('#stale').hidden"), "고친 뒤 등기 글이 바뀌면 덮어쓰지 않고 '다시 뽑기'를 묻는다");
  ok(await js("document.querySelector('#rights .amt').value") === "1억 2천만", "고친 금액이 그대로");

  console.log("다른 시나리오");
  for (const [id, grade] of [["officetel", "위험"], ["clean", "양호"], ["amended", "주의"]]) {
    await js(`app.runDemo(${JSON.stringify(id)})`);
    ok(await js("document.querySelector('#verdict').textContent") === grade, `${id} → ${grade}`);
  }
  const amendedRows = await js(`[...document.querySelectorAll('#rights .right .amt')].map(i => i.value)`);
  ok(JSON.stringify(amendedRows) === JSON.stringify(["6천만"]), `부기 변경 반영 근저당 6천만 — ${amendedRows}`);

  console.log("빈칸·잘못 쓴 칸");
  await cdp("Page.navigate", { url: `${base}/app/` });
  await until("document.documentElement.dataset.ready === '1'");
  await click("button.go");
  ok(/붙여 넣거나/.test(await js("document.querySelector('#formErr').textContent")), "아무것도 안 넣고 누르면 무엇을 넣을지 알려 준다");
  await js("app.runDemo('villa', {submit:false})");
  await js("document.querySelector('#deposit').value='많이'");
  await click("button.go");
  ok(await js("document.activeElement.id") === "deposit", "보증금을 못 읽으면 그 칸으로 초점");

  console.log("휴대폰 폭(390px)");
  await viewport(390, 844, true);
  await js("app.runDemo('villa')");
  await sleep(300);
  ok(await js("document.documentElement.scrollWidth <= innerWidth"), "가로로 넘치지 않는다");
  // 문장 속 용어는 글자 링크라 빼고, 따로 선 단추만 본다
  const small = await js(`[...document.querySelectorAll('button:not(.row .term), select, input:not([type=checkbox]), summary')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 36).map(e => e.className || e.id || e.tagName)`);
  ok(small.length === 0, `누를 곳이 너무 작지 않다 ${small.join(",")}`);
  await js("scrollTo(0,0)");
  await shot("demo-mobile.png");

  console.log("어두운 화면");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await viewport(1180, 900);
  await js("app.runDemo('officetel')");
  await sleep(300);
  await js("scrollTo(0,0)");
  await shot("demo-dark.png");

  ok(errors.length === 0, `콘솔 오류 없음 ${errors.join(" | ")}`);
} catch (e) {
  fails.push(String(e.stack || e));
  console.error(e);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  server.close();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
console.log(fails.length ? `\n실패 ${fails.length}개` : "\n데모 장면 전부 통과");
process.exit(fails.length ? 1 : 0);
