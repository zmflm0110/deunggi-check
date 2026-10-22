/** 신호등 결과·이유·행동 목록·면책 안내를 한 화면에 보여 준다.
 * 빨강·노랑 줄은 펼쳐서, 양호 줄은 '문제없는 항목 N개'로 접어서 보여 준다 — 봐야 할 것만 먼저 눈에 들어오게. */
/** @typedef {import("./ExplanationBuilder.js").Report} Report */
/** @typedef {import("./ExplanationBuilder.js").ReportRow} ReportRow */
import { GRADE_LABEL } from "./ExplanationBuilder.js";
import { esc, bindTerms } from "./CheckFormView.js";

const COLOR_WORD = { red: "빨강", yellow: "노랑", green: "초록", unknown: "모름" };

/** 문장 속 용어(근저당·가압류 …)를 누르면 뜻이 뜨는 버튼으로 — 한 줄에서 처음 나온 것만 */
export function linkTerms(text, glossary) {
  let html = esc(text);
  const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
  const used = new Set();
  for (const t of terms) {
    if (used.has(t) || [...used].some(u => u.includes(t))) continue;
    const i = html.indexOf(t);
    if (i < 0 || /<[^>]*$/.test(html.slice(0, i))) continue;
    html = html.slice(0, i) + `<button type="button" class="term" data-term="${esc(t)}">${esc(t)}</button>` + html.slice(i + t.length);
    used.add(t);
  }
  return html;
}

export class ResultView {
  /** @param {HTMLElement} rootEl @param {Object<string, string>} glossary */
  constructor(rootEl, glossary = {}) {
    /** @type {HTMLElement} 결과가 그려질 DOM 요소 */
    this.rootEl = rootEl;
    /** @type {Object<string, string>} 위험·주의·양호별 색상 클래스 */
    this.gradeColors = { red: "g-red", yellow: "g-yellow", green: "g-green", unknown: "g-unknown", info: "g-info" };
    this.glossary = glossary;
    bindTerms(rootEl, glossary);
  }

  /** 전체 등급과 항목별 신호등, 이유, 행동 목록을 그린다.
   * @param {Report} report
   * @returns {void}
   */
  render(report) {
    this.clear();
    // 비율 머리글은 그 비율이 빨강·노랑일 때만 크게 — 초록 비율을 '위험' 바로 밑에 두면 신호가 엇갈린다
    const head = report.rows.find(r => r.item === "ratio" && r.headline && (r.grade === "red" || r.grade === "yellow"));
    const shown = report.rows.filter(r => r.grade !== "green"), ok = report.rows.filter(r => r.grade === "green");
    const box = document.createElement("section");
    box.className = `result ${this.gradeColors[report.grade]}`;
    box.setAttribute("aria-labelledby", "verdict");
    box.innerHTML = `
      <div class="verdict">
        <span class="light" aria-hidden="true"></span>
        <div><h2 id="verdict" tabindex="-1">${esc(report.gradeLabel)}</h2><p>${esc(report.summary)}</p></div>
      </div>
      ${head ? `<p class="headline ${this.gradeColors[head.grade]}"><span>${esc(head.headline)}</span> <em><span class="sr">— </span>${esc(COLOR_WORD[head.grade])}</em></p>` : ""}
      <h3>점검 결과</h3>
      <ul class="rows"></ul>
      ${ok.length ? `<details class="oks"><summary>문제없는 항목 ${ok.length}개</summary><ul class="rows"></ul></details>` : ""}
      <h3 id="todo">계약 전에 할 일 <small>중개사에게 물어볼 것</small></h3>
      <ol class="actions">${report.actions.map((a, i) => `<li><label><input type="checkbox"><span>${esc(a)}</span></label></li>`).join("")}</ol>
      <div class="share"><button type="button" class="ghost" id="copyQ">질문 복사하기</button><span class="copied" aria-live="polite"></span></div>
      <p class="disclaimer">${esc(report.disclaimer)}</p>`;
    const [main, rest] = box.querySelectorAll("ul.rows");
    for (const r of shown) main.appendChild(this.renderRow(r));
    if (!shown.length) main.innerHTML = `<li class="row g-green"><span class="dot" aria-hidden="true"></span><div><b>빨강·노랑 항목이 없어요</b><p>아래 할 일만 챙기세요.</p></div></li>`;
    for (const r of ok) rest.appendChild(this.renderRow(r));
    box.querySelector("#copyQ").onclick = async () => {
      const text = `[등기체크] ${report.gradeLabel} — ${report.summary}\n` + report.actions.map((a, i) => `${i + 1}. ${a}`).join("\n");
      const out = box.querySelector(".copied");
      try { await navigator.clipboard.writeText(text); out.textContent = "복사했어요 — 문자나 메신저에 붙여 넣으세요."; }
      catch { out.textContent = "복사가 막혀 있어요 — 목록을 길게 눌러 직접 복사하세요."; }
    };
    this.rootEl.appendChild(box);
    this.rootEl.hidden = false;
  }

  /** 항목 한 줄(신호등+이유)을 모바일에서도 보이게 만든다.
   * @param {ReportRow} ruleResult
   * @returns {HTMLElement}
   */
  renderRow(ruleResult) {
    const r = ruleResult, li = document.createElement("li");
    li.className = `row ${this.gradeColors[r.grade]}`;
    li.innerHTML = `
      <span class="dot" aria-hidden="true"></span>
      <div>
        <div class="row-head"><b>${linkTerms(r.title, this.glossary)}</b><span class="tag">${esc(GRADE_LABEL[r.grade])}</span>
          ${r.ranks.length && r.grade !== "green" ? `<span class="ranks">${esc(r.ranks.join(" · "))}</span>` : ""}</div>
        <p>${r.grade === "green" ? esc(r.reason) : linkTerms(r.reason, this.glossary)}</p>
      </div>`;
    return li;
  }

  /** 이전 결과를 지운다.
   * @returns {void}
   */
  clear() {
    this.rootEl.querySelectorAll(".result").forEach(n => n.remove());
  }
}
