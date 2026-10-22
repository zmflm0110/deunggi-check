/** 붙여 넣은 등기부등본 글에서 근저당·가압류·소유자 같은 항목을 자동으로 뽑는다.
 *
 * 인터넷등기소 '열람'에서 복사한 글은 표 칸이 공백·탭·| 로 흩어져 온다. 칸을 믿지 않고
 *  1. 【 갑 구 】【 을 구 】 제목으로 섹션을 나누고,
 *  2. 줄 맨 앞 순위번호(1, 2, 1-1 …) + 등기목적 낱말로 항목의 시작을 잡아 다음 항목 전까지 줄을 잇고,
 *  3. 부기등기(1-1 근저당권변경·1-2 근저당권이전)는 본 등기(1번)의 금액·권리자를 바꾸는 것으로 접고,
 *  4. 'N번…말소'가 가리키는 등기는 지운다(말소사항 포함본도 현재 유효사항처럼).
 * 뽑은 값은 화면에서 사람이 보고 고친다 — 파서가 틀릴 수 있어서(위험 1순위 '등기부 해석 오류').
 */
import { parseMoney } from "./money.js";

/** @typedef {{section: 'gap'|'eul', rank: string, type: string, purpose: string, date: string, amount: number,
 *             amountLabel: string, holder: string, text: string}} Right */
/** @typedef {{owner: string, ownerIsTrustee: boolean, rights: Right[], warnings: string[], cancelled: string[], folded: string[]}} RegistryInfo */

const PURPOSES = ["소유권보존", "소유권이전청구권가등기", "소유권이전", "임의경매개시결정", "강제경매개시결정", "경매개시결정",
  "가압류", "압류", "가처분", "가등기", "신탁", "근저당권설정", "근저당권이전", "근저당권변경", "근저당권", "전세권설정",
  "전세권이전", "전세권변경", "전세권", "주택임차권", "임차권설정", "임차권등기", "임차권", "지상권설정", "질권"];

/** 등기목적·내용 → 종류. 위험한 것부터 본다('가압류'에는 '압류'가 들어 있어서 먼저). */
export function classify(purpose, text) {
  const t = `${purpose} ${text}`.replace(/\s+/g, "");
  if (/경매개시결정/.test(t)) return "auction";
  if (/가압류/.test(t)) return "provisional";
  if (/압류/.test(t)) return "seizure";
  if (/가처분/.test(t)) return "injunction";
  if (/가등기/.test(t)) return "preregister";
  if (/^소유권(보존|이전)/.test(purpose) && /신탁|수탁자/.test(t)) return "trust";
  if (/^신탁/.test(purpose)) return "trust";
  if (/임차권/.test(t)) return "lease";
  if (/근저당/.test(purpose)) return "mortgage";
  if (/전세권/.test(purpose)) return "jeonse";
  if (/^소유권(보존|이전)/.test(purpose)) return "owner";
  return "other";
}

export const TYPE_NAMES = { mortgage: "근저당", jeonse: "전세권", lease: "임차권등기", provisional: "가압류", seizure: "압류",
  injunction: "가처분", auction: "경매 시작", trust: "신탁", preregister: "가등기", owner: "소유권", other: "기타 권리" };

export class RegistryParser {
  constructor() {
    /** @type {Object<string, RegExp>} 섹션 제목·항목 시작·금액·권리자를 찾는 정규식 */
    this.patterns = {
      title: /【\s*표\s*제\s*부\s*】/, gap: /【\s*갑\s*구\s*】/, eul: /【\s*을\s*구\s*】/,
      start: /^\s*(\d+(?:-\d+)?)\s+(.+)$/,
      date: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,
      amount: /(채권최고액|전세금|임차보증금|청구금액)\s*(금\s*[\d,억천백만\s]+원)/,
      holder: /(근저당권자|전세권자|채권자|수탁자|임차권자|소유자|권리자)\s+([^\s]+)/,
    };
    /** @type {number} 마지막으로 읽은 글의 길이 — 아무것도 못 뽑았을 때 '붙여 넣었는데 왜 비었지'를 가려 주려고 */
    this.lastRawLength = 0;
  }

  /** 등기 글 전체에서 항목을 뽑아 RegistryInfo 로 만든다.
   * @param {string} rawText
   * @returns {RegistryInfo}
   */
  parse(rawText) {
    const src = String(rawText || "").replace(/\r\n?/g, "\n");
    this.lastRawLength = src.trim().length;
    const warnings = [];
    const sec = this.sections(src);
    if (!sec.gap && !sec.eul) warnings.push("【갑 구】【을 구】 제목을 못 찾았어요 — 등기부등본 전체를 붙여 넣었는지 확인하세요.");
    const raw = [...this.entries(sec.gap, "gap", warnings), ...this.entries(sec.eul, "eul", warnings)];
    const { rights, cancelled, folded } = this.resolve(raw);
    const owners = rights.filter(r => r.type === "owner" || r.type === "trust");
    const last = owners[owners.length - 1];
    return { owner: last ? last.holder : "", ownerIsTrustee: !!last && last.type === "trust",
             rights: rights.filter(r => r.type !== "owner"), warnings, cancelled, folded };
  }

  /** 근저당 항목의 채권자와 채권최고액(부기로 바뀐 금액 반영)을 찾아낸다. */
  extractMortgages(rawText) {
    return this.parse(rawText).rights.filter(r => r.type === "mortgage").map(r => ({ rank: r.rank, creditor: r.holder, maxAmount: r.amount, date: r.date }));
  }

  /** 가압류·압류·가처분·경매 같은 항목이 있는지 찾아낸다. */
  extractSeizures(rawText) {
    return this.parse(rawText).rights.filter(r => ["provisional", "seizure", "injunction", "auction"].includes(r.type))
      .map(r => ({ type: TYPE_NAMES[r.type], date: r.date, amount: r.amount }));
  }

  /** 갑구의 지금 소유자(신탁이면 수탁자) 이름을 찾아낸다. */
  extractOwner(rawText) {
    return this.parse(rawText).owner;
  }

  /** @private 표제부·갑구·을구 덩어리 */
  sections(src) {
    const found = ["title", "gap", "eul"].map(k => { const m = src.match(this.patterns[k]); return m ? { k, at: m.index, len: m[0].length } : null; })
      .filter(Boolean).sort((a, b) => a.at - b.at);
    const out = { title: "", gap: "", eul: "" };
    found.forEach((f, i) => { out[f.k] = src.slice(f.at + f.len, i + 1 < found.length ? found[i + 1].at : src.length); });
    return out;
  }

  /** @private 한 섹션 → 항목(여러 줄을 이어 붙임) */
  entries(text, section, warnings) {
    const out = [];
    let cur = null;
    for (let line of String(text || "").split("\n")) {
      line = line.replace(/[|\t]/g, " ").trimEnd();
      if (!line.trim() || /^\s*(순위번호|표시번호)/.test(line) || /^\s*\(\s*소유권/.test(line) || /기록사항\s*없음/.test(line)) continue;
      const m = line.match(this.patterns.start);
      const purpose = m && this.purposeOf(m[2]);
      if (m && purpose) {
        if (cur) out.push(cur);
        cur = { section, rank: m[1], purpose, text: m[2].trim() };
      } else if (cur) cur.text += " " + line.trim();
      else if (line.trim().length > 2) warnings.push(`읽지 못한 줄: ${line.trim().slice(0, 40)}`);
    }
    if (cur) out.push(cur);
    return out.map(e => this.fill(e));
  }

  /** @private 줄 글의 등기목적 — 'N번…말소'는 '말소', 'N번근저당권변경' 같은 부기는 그 목적 */
  purposeOf(s) {
    const t = s.replace(/\s+/g, "");
    const ref = t.match(/^(\d+(?:-\d+)?)번(.+)$/);
    if (ref) return /(말소|해지|해제)/.test(ref[2].slice(0, 40)) ? "말소" : PURPOSES.find(p => ref[2].startsWith(p)) || "";
    return PURPOSES.find(p => t.startsWith(p)) || "";
  }

  /** @private 접수일·금액·권리자·가리키는 순위번호 */
  fill(e) {
    const t = e.text.replace(/\s+/g, " ");
    const d = t.match(this.patterns.date), a = t.match(this.patterns.amount), h = t.match(this.patterns.holder);
    const ref = t.replace(/\s+/g, "").match(/^(\d+(?:-\d+)?)번/);
    return { ...e, text: t, type: e.purpose === "말소" ? "cancel" : classify(e.purpose, t),
             date: d ? `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}` : "",
             amount: a ? (Number.isFinite(parseMoney(a[2])) ? parseMoney(a[2]) : 0) : 0, amountLabel: a ? a[1] : "",
             holder: h ? h[2] : "", ref: ref ? ref[1] : "" };
  }

  /** @private 부기(N-M)는 본 등기에 접고, 말소는 지운다 */
  resolve(raw) {
    const key = (s, r) => `${s}:${r}`;
    const main = new Map(), cancelled = [], folded = [];
    for (const e of raw) {
      if (e.type === "cancel") continue;
      const sub = e.rank.match(/^(\d+)-\d+$/);
      const target = sub ? key(e.section, sub[1]) : e.ref && /변경|이전/.test(e.purpose) ? key(e.section, e.ref) : "";
      if (target && main.has(target) && e.type !== "owner") {        // 부기 — 금액이 바뀌거나(변경) 권리자가 바뀐다(이전)
        const m = main.get(target);
        if (e.amount && /변경/.test(e.purpose)) m.amount = e.amount;
        if (e.holder && /이전/.test(e.purpose)) m.holder = e.holder;
        folded.push(`${e.section === "gap" ? "갑구" : "을구"} ${e.rank}번 ${e.purpose} → ${target.split(":")[1]}번에 반영`);
        continue;
      }
      main.set(key(e.section, e.rank), { ...e });
    }
    for (const e of raw) {
      if (e.type !== "cancel" || !e.ref) continue;
      const k = key(e.section, e.ref.split("-")[0]);
      if (main.delete(k)) cancelled.push(`${e.section === "gap" ? "갑구" : "을구"} ${e.ref}번`);
    }
    const rights = [...main.values()].map(({ ref, ...r }) => ({ ...r, name: TYPE_NAMES[r.type] || TYPE_NAMES.other }));
    return { rights, cancelled, folded };
  }
}
