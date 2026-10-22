/** 등기 글 붙여 넣기와 보증금·시세 입력, 자동 추출값 수정 폼을 보여 준다.
 *
 * 붙여 넣으면 바로 뽑는다(버튼 없이). 사람이 뽑힌 칸을 고친 뒤에 글이 바뀌면 덮어쓰지 않고 '다시 뽑기'를 묻는다.
 * 돈 칸은 적는 대로 '= 9천만 원'처럼 읽은 값을 보여 줘서, 1억5천을 1억 5천 원으로 잘못 읽는 일을 사람이 바로 본다. */
/** @typedef {import("./RegistryParser.js").RegistryParser} RegistryParser */
/** @typedef {import("./RegistryParser.js").RegistryInfo} RegistryInfo */
/** @typedef {import("./RuleEngine.js").CheckInput} CheckInput */
import { parseMoney, won } from "./money.js";
import { TYPE_NAMES } from "./RegistryParser.js";

export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 표에서 고를 수 있는 권리 종류 — 위험한 것부터 */
const EDITABLE = ["mortgage", "jeonse", "lease", "provisional", "seizure", "auction", "injunction", "trust", "preregister", "other"];
const HAS_AMOUNT = new Set(["mortgage", "jeonse", "lease", "provisional", "seizure"]);
const GLOSS_OF = { mortgage: "근저당", jeonse: "전세권", lease: "임차권등기", provisional: "가압류", seizure: "압류", injunction: "가처분", trust: "신탁", preregister: "가등기" };

export class CheckFormView {
  /** @param {HTMLElement} rootEl @param {RegistryParser} parser @param {Object<string, string>} glossary */
  constructor(rootEl, parser, glossary = {}) {
    /** @type {HTMLElement} 폼이 그려질 DOM 요소 */
    this.rootEl = rootEl;
    /** @type {Object<string, string>} 툴팁에 쓸 용어 설명 */
    this.glossary = glossary;
    /** @type {Function} 제출 시 호출할 콜백 — (CheckInput) => void */
    this.onSubmit = () => {};
    /** @type {Function} 샘플을 고르면 부르는 콜백 — (id) => void */
    this.onSample = () => {};
    this.parser = parser;
    this.info = null;
    this.edited = false;
    this.parsedText = "";
  }

  /** 입력창, 추출 항목 수정칸, 용어 툴팁을 그린다.
   * @param {{id: string, name: string}[]} [samples]
   * @returns {void}
   */
  render(samples = []) {
    this.rootEl.innerHTML = `
      <form class="check" novalidate>
        <section class="step" aria-labelledby="s1">
          <div class="step-head"><span class="num">1</span><h2 id="s1">등기부등본 글 붙여 넣기</h2>
            ${samples.length ? `<label class="sample"><span class="sr">샘플</span><select id="sample">
              <option value="">샘플로 해 보기</option>${samples.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></label>` : ""}</div>
          <p class="hint">인터넷등기소에서 등기부등본을 <b>열람</b>한 뒤 화면 글을 전부 복사(⌘A·⌘C)해 붙여 넣으세요. 이 글은 이 기기 밖으로 나가지 않아요.</p>
          <textarea id="reg" rows="7" spellcheck="false" autocomplete="off" aria-describedby="regNote"
            placeholder="【 갑 구 】 … 【 을 구 】 … 가 들어간 등기부등본 글"></textarea>
          <p class="note" id="regNote" aria-live="polite"></p>
        </section>

        <section class="step" aria-labelledby="s2" id="extract" hidden>
          <div class="step-head"><span class="num">2</span><h2 id="s2">뽑힌 항목 — 맞는지 보고 고치세요</h2></div>
          <p class="stale" id="stale" hidden>등기 글이 바뀌었어요. <button type="button" class="link" id="reparse">다시 뽑기</button> (고친 칸은 지워져요)</p>
          <div class="field owner"><label for="owner">지금 소유자 <button type="button" class="term" data-term="갑구">갑구</button></label>
            <input id="owner" autocomplete="off" placeholder="예: 한○○"></div>
          <div class="rights" id="rights" role="list" aria-label="갑구·을구에서 뽑은 권리"></div>
          <button type="button" class="ghost" id="addRight">항목 더하기</button>
          <ul class="folded" id="folded"></ul>
        </section>

        <section class="step" aria-labelledby="s3">
          <div class="step-head"><span class="num">3</span><h2 id="s3">내 계약</h2></div>
          <div class="grid3">
            <div class="field"><label for="deposit">내 보증금</label>
              <input id="deposit" inputmode="text" autocomplete="off" placeholder="예: 1억" aria-describedby="depositRead">
              <output id="depositRead" class="read"></output></div>
            <div class="field"><label for="price">집 시세(대략)</label>
              <input id="price" inputmode="text" autocomplete="off" placeholder="예: 1억 5천만" aria-describedby="priceRead">
              <output id="priceRead" class="read"></output></div>
            <div class="field"><label for="counterparty">계약할 사람 이름</label>
              <input id="counterparty" autocomplete="off" placeholder="예: 한지민 (모르면 비워 두기)"></div>
          </div>
          <p class="hint">시세는 같은 건물·비슷한 집의 최근 매매가로 어림해요. 모르면 비워 둬도 되지만 그러면 가장 중요한 비율을 못 봐요.</p>
          <p class="err" id="formErr" role="alert" hidden></p>
          <button class="go" type="submit">확인</button>
        </section>
      </form>`;
    const $ = s => this.rootEl.querySelector(s);
    const reg = $("#reg");
    let t = 0;
    reg.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => this.autoParse(), 200); });
    reg.addEventListener("paste", () => setTimeout(() => this.autoParse(), 0));
    $("#reparse").onclick = () => { this.edited = false; this.autoParse(); };
    $("#addRight").onclick = () => { this.addRow({ type: "mortgage", amount: 0, holder: "", section: "eul", rank: "" }, true); this.markEdited(); };
    $("#rights").addEventListener("input", () => this.markEdited());
    $("#rights").addEventListener("change", e => { if (e.target.matches("select")) this.syncRow(e.target.closest(".right")); this.markEdited(); });
    $("#rights").addEventListener("click", e => {
      const del = e.target.closest(".del");
      if (del) { const row = del.closest(".right"); const next = row.nextElementSibling || row.previousElementSibling; row.remove(); this.markEdited(); (next ? next.querySelector("select") : $("#addRight")).focus(); }
    });
    $("#owner").addEventListener("input", () => this.markEdited());
    for (const id of ["deposit", "price"]) $(`#${id}`).addEventListener("input", () => this.showRead(id));
    if ($("#sample")) $("#sample").onchange = e => { if (e.target.value) this.onSample(e.target.value); };
    this.rootEl.querySelector("form").onsubmit = e => { e.preventDefault(); const v = this.readInput(); if (v) this.onSubmit(v); };
    reg.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.rootEl.querySelector("form").requestSubmit(); } });
    bindTerms(this.rootEl, this.glossary);
  }

  /** 자동으로 뽑은 값을 수정 가능한 칸에 채워 넣는다.
   * @param {RegistryInfo} info
   * @returns {void}
   */
  fillExtracted(info) {
    const $ = s => this.rootEl.querySelector(s);
    this.info = info;
    this.edited = false;
    $("#stale").hidden = true;
    $("#extract").hidden = false;
    $("#owner").value = info.owner || "";
    const box = $("#rights");
    box.innerHTML = "";
    for (const r of info.rights) this.addRow(r);
    if (!info.rights.length) box.innerHTML = `<p class="empty">갑구·을구에 걸린 권리가 없어요(소유권만 있음). 빠진 게 보이면 '항목 더하기'로 넣으세요.</p>`;
    const notes = [
      ...info.folded.map(f => `부기 등기를 본 등기에 합쳤어요 — ${f}`),
      ...info.cancelled.map(c => `말소돼서 뺐어요 — ${c}`),
      ...(info.ownerIsTrustee ? ["소유자가 신탁회사(수탁자)예요 — 계약하는 집주인은 맡긴 사람(위탁자)일 거예요."] : []),
      ...info.warnings.slice(0, 3)];
    $("#folded").innerHTML = notes.map(n => `<li>${esc(n)}</li>`).join("");
    const n = info.rights.length;
    $("#regNote").textContent = n || info.owner ? `소유자 ${info.owner || "못 찾음"} · 권리 ${n}개를 뽑았어요.` : info.warnings[0] || "";
  }

  /** 폼 값을 숫자 변환해 CheckInput으로 읽어 온다. 모자라면 화면에 알리고 null.
   * @returns {CheckInput|null}
   */
  readInput() {
    const $ = s => this.rootEl.querySelector(s), err = $("#formErr");
    if (!this.info && $("#reg").value.trim()) this.autoParse();
    const rights = [...this.rootEl.querySelectorAll("#rights .right")].map(row => {
      const type = row.querySelector("select").value, amount = parseMoney(row.querySelector(".amt").value);
      return { ...JSON.parse(row.dataset.base || "{}"), type, name: TYPE_NAMES[type], amount: Number.isFinite(amount) ? amount : 0,
               holder: row.querySelector(".holder").value.trim() };
    });
    const deposit = parseMoney($("#deposit").value), priceText = $("#price").value.trim(), price = parseMoney(priceText);
    const rows = [...this.rootEl.querySelectorAll("#rights .right")];
    const missingAmount = rights.findIndex(r => r.type === "mortgage" && !r.amount) + 1;
    const why = !$("#reg").value.trim() && !rights.length ? ["reg", "등기부등본 글을 붙여 넣거나 위에서 샘플을 골라 주세요."]
      : missingAmount ? [null, "근저당의 채권최고액을 적어 주세요 — 등기부 을구의 '채권최고액 금…원'이에요."]
      : !(deposit > 0) ? ["deposit", "보증금을 적어 주세요 — 예: 1억, 5000만, 8천만"]
      : priceText && !(price > 0) ? ["price", "시세를 돈으로 읽지 못했어요 — 예: 1억 5천만"] : null;
    err.hidden = !why;
    err.textContent = why ? why[1] : "";
    for (const id of ["reg", "deposit", "price"]) $(`#${id}`).toggleAttribute("aria-invalid", !!why && why[0] === id);
    if (why) {
      const target = why[0] ? $(`#${why[0]}`) : rows[missingAmount - 1].querySelector(".amt");
      if (target) target.focus();
      return null;
    }
    return { rights, owner: $("#owner").value.trim(), ownerIsTrustee: !!(this.info && this.info.ownerIsTrustee),
             counterparty: $("#counterparty").value.trim(), deposit, price: price > 0 ? price : NaN };
  }

  /** 데모·샘플용 — 글과 계약 값을 칸에 넣는다(사람이 쓴 것처럼) */
  setValues({ text, deposit, price, counterparty }) {
    const $ = s => this.rootEl.querySelector(s);
    if (text != null) { $("#reg").value = text; this.edited = false; this.autoParse(); }
    const num = n => (n ? won(n).replace(/ 원$/, "") : "");
    if (deposit != null) { $("#deposit").value = num(deposit); this.showRead("deposit"); }
    if (price != null) { $("#price").value = num(price); this.showRead("price"); }
    if (counterparty != null) $("#counterparty").value = counterparty;
  }

  /** @private 붙여 넣은 글을 읽어 2단계 칸을 채운다 */
  autoParse() {
    const text = this.rootEl.querySelector("#reg").value;
    if (text === this.parsedText && this.info) return;
    if (this.edited && this.info) { this.rootEl.querySelector("#stale").hidden = false; return; }
    this.parsedText = text;
    if (!text.trim()) { this.info = null; this.rootEl.querySelector("#extract").hidden = true; this.rootEl.querySelector("#regNote").textContent = ""; return; }
    this.fillExtracted(this.parser.parse(text));
  }

  /** @private */
  markEdited() {
    if (this.info) this.edited = true;
  }

  /** @private 권리 한 줄 — 종류 고르기·금액·권리자·지우기 */
  addRow(r, focus = false) {
    const box = this.rootEl.querySelector("#rights");
    const empty = box.querySelector(".empty");
    if (empty) empty.remove();
    const row = document.createElement("div");
    row.className = "right";
    row.setAttribute("role", "listitem");
    const { section, rank, date } = r;
    row.dataset.base = JSON.stringify({ section, rank, date });
    const where = rank ? `${section === "gap" ? "갑구" : "을구"} ${rank}번` : "직접 넣음";
    const amountText = r.amount ? won(r.amount).replace(/ 원$/, "") : "";
    const types = EDITABLE.includes(r.type) ? EDITABLE : [r.type, ...EDITABLE];
    row.innerHTML = `
      <span class="where">${esc(where)}${date ? ` · ${esc(date)}` : ""}</span>
      <label class="sr" for="t${this.seq = (this.seq || 0) + 1}">종류</label>
      <select id="t${this.seq}">${types.map(t => `<option value="${t}"${t === r.type ? " selected" : ""}>${esc(TYPE_NAMES[t] || t)}</option>`).join("")}</select>
      <label class="amt-wrap"><span class="sr">금액</span><input class="amt" autocomplete="off" inputmode="text" value="${esc(amountText)}" placeholder="금액"></label>
      <label class="holder-wrap"><span class="sr">권리자</span><input class="holder" autocomplete="off" value="${esc(r.holder || "")}" placeholder="권리자(은행·채권자)"></label>
      <button type="button" class="del" aria-label="${esc(where)} 항목 지우기">지우기</button>
      <span class="gloss"></span>`;
    box.appendChild(row);
    this.syncRow(row);
    if (focus) row.querySelector("select").focus();
  }

  /** @private 종류에 따라 금액 칸을 켜고 끄고, 용어 버튼을 단다 */
  syncRow(row) {
    const type = row.querySelector("select").value;
    const amt = row.querySelector(".amt");
    amt.disabled = !HAS_AMOUNT.has(type);
    amt.placeholder = type === "mortgage" ? "채권최고액" : type === "jeonse" ? "전세금" : type === "lease" ? "임차보증금" : HAS_AMOUNT.has(type) ? "청구금액" : "금액 없음";
    if (amt.disabled) amt.value = "";
    const term = GLOSS_OF[type];
    row.querySelector(".gloss").innerHTML = term && this.glossary[term] ? `<button type="button" class="term" data-term="${esc(term)}">${esc(term)} 뜻</button>` : "";
  }

  /** @private 돈 칸 아래 '= 1억 원' */
  showRead(id) {
    const v = this.rootEl.querySelector(`#${id}`).value, n = parseMoney(v), out = this.rootEl.querySelector(`#${id}Read`);
    out.textContent = !v.trim() ? "" : Number.isFinite(n) ? `= ${won(n)}` : "돈으로 못 읽었어요";
    out.classList.toggle("bad", !!v.trim() && !Number.isFinite(n));
  }
}

/** 용어 버튼(.term[data-term]) → 설명 말풍선. 누르면 열고, 다시 누르거나 Esc·바깥을 누르면 닫힌다.
 * @param {HTMLElement} root @param {Object<string, string>} glossary */
export function bindTerms(root, glossary) {
  const pop = document.createElement("div");
  pop.className = "pop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  root.appendChild(pop);
  let open = null;
  const close = () => { if (open) open.setAttribute("aria-expanded", "false"); open = null; pop.hidden = true; };
  root.addEventListener("click", e => {
    const b = e.target.closest(".term");
    if (!b) { if (!e.target.closest(".pop")) close(); return; }
    e.preventDefault();
    if (open === b) return close();
    close();
    const def = glossary[b.dataset.term];
    if (!def) return;
    pop.innerHTML = `<b>${esc(b.dataset.term)}</b> ${esc(def)}`;
    pop.hidden = false;
    const r = b.getBoundingClientRect(), host = root.getBoundingClientRect();
    pop.style.top = `${r.bottom - host.top + 6}px`;
    pop.style.left = `${Math.max(0, Math.min(r.left - host.left, host.width - pop.offsetWidth))}px`;
    b.setAttribute("aria-expanded", "true");
    open = b;
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && open) { const b = open; close(); b.focus(); } });
}
