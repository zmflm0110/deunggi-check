/** 체크리스트 규칙을 순서대로 평가해 항목별 위험·주의·양호를 낸다.
 *
 * 규칙은 data/rules.json 에 있다. 규칙 하나 = 점검 항목(item) + 조건(when) + 등급(grade).
 * 조건은 conditionHandlers 의 이름(has·ratioAtLeast·ratioBelow·ownerMismatch·trustee·always)이고, 여러 개면 모두 맞아야 걸린다.
 * 판정 함수는 true(걸림)·false(안 걸림)·null(입력이 없어 모름) 중 하나를 낸다.
 * 한 항목에 규칙이 여럿이면(비율 80%↑ 빨강, 70~80% 노랑) 가장 나쁜 등급이 그 항목의 신호등이 된다. */
/** @typedef {import("./RuleRepository.js").RuleRepository} RuleRepository */
/** @typedef {import("./RegistryParser.js").Right} Right */
import { won } from "./money.js";

/** @typedef {{rights: Right[], owner: string, ownerIsTrustee?: boolean, counterparty: string, deposit: number, price: number}} CheckInput */
/** @typedef {{id: string, item: string, title: string, when: Object<string, any>, grade: 'red'|'yellow'|'info', reason: string, actions: string[]}} Rule */
/** @typedef {{id: string, item: string, title: string, grade: string, hit: boolean, unknown: boolean, matched: Right[], vars: Object<string, string>, actions: string[]}} RuleResult */
/** @typedef {{item: string, grade: 'red'|'yellow'|'green'|'unknown'|'info', rule: RuleResult|null, matched: Right[]}} ItemResult */
/** @typedef {{grade: 'red'|'yellow'|'green', ratio: number, debt: number, items: ItemResult[], results: RuleResult[], vars: Object<string, string>}} CheckResult */

export const GRADES = ["red", "yellow", "unknown", "green", "info"];
const worse = (a, b) => (GRADES.indexOf(a) <= GRADES.indexOf(b) ? a : b);

/** 선순위로 치는 권리 — 새로 들어오는 세입자보다 먼저 돈을 가져가는 것 */
export const SENIOR = ["mortgage", "jeonse", "lease"];

/** 등기부 이름은 '한○○'처럼 가려져 있다. 가려지지 않은 글자끼리만 견줘서 다르면 다른 사람으로 본다. */
export function sameName(a, b) {
  const clean = s => String(s || "").replace(/\s+/g, "").replace(/^(주식회사|\(주\))/, "");
  const x = clean(a), y = clean(b);
  if (!x || !y) return null;
  if (x.length !== y.length) return false;
  const hidden = c => /[○◯●*xX＊]/.test(c);
  return [...x].every((c, i) => hidden(c) || hidden(y[i]) || c === y[i]);
}

export class RuleEngine {
  constructor() {
    /** @type {Rule[]} JSON에서 불러온 규칙 목록 */
    this.rules = [];
    /** @type {Object<string, Function>} 규칙 type별 조건 판정 함수 맵 — (조건 값, 입력, 미리 센 값) → true·false·null */
    this.conditionHandlers = {
      has: (types, input) => input.rights.some(r => types.includes(r.type)),
      ratioAtLeast: (v, input, ctx) => (Number.isFinite(ctx.ratio) ? ctx.ratio >= v : null),
      ratioBelow: (v, input, ctx) => (Number.isFinite(ctx.ratio) ? ctx.ratio < v : null),
      ownerMismatch: (v, input) => { const same = sameName(input.owner, input.counterparty); return same === null ? null : !same === v; },
      trustee: (v, input) => !!input.ownerIsTrustee === v,
      always: v => !!v,
    };
  }

  /** JSON으로 정의한 규칙을 엔진에 넣고 형식을 확인한다.
   * @param {Rule[]} rules
   * @returns {void}
   */
  loadRules(rules) {
    if (!Array.isArray(rules) || !rules.length) throw new Error("규칙이 비어 있어요");
    for (const r of rules) {
      const bad = !r.id ? "id 없음" : !r.item ? "item 없음" : !["red", "yellow", "info"].includes(r.grade) ? `grade '${r.grade}'`
        : !r.when || !Object.keys(r.when).length ? "when 없음"
        : Object.keys(r.when).find(k => !this.conditionHandlers[k]) ? `모르는 조건 '${Object.keys(r.when).find(k => !this.conditionHandlers[k])}'` : "";
      if (bad) throw new Error(`규칙 ${r.id || "?"}: ${bad}`);
    }
    this.rules = rules;
  }

  /** 모든 규칙을 순서대로 평가해 항목별 결과와 전체 등급을 만든다.
   * @param {CheckInput} input
   * @returns {CheckResult}
   */
  evaluate(input) {
    input = { rights: [], owner: "", counterparty: "", deposit: 0, price: NaN, ...input };
    const ctx = this.context(input);
    const results = this.rules.map(rule => this.evaluateRule(rule, input, ctx));
    const items = new Map();
    for (const r of results) {
      const it = items.get(r.item) || { item: r.item, grade: r.grade === "info" ? "info" : "green", rule: null, matched: [] };
      const g = r.grade === "info" ? "info" : r.hit ? r.grade : r.unknown ? "unknown" : "green";
      if (GRADES.indexOf(g) < GRADES.indexOf(it.grade)) { it.grade = g; it.rule = r.hit || r.unknown ? r : it.rule; it.matched = r.matched; }
      items.set(r.item, it);
    }
    const list = [...items.values()];
    const grade = list.reduce((g, it) => (it.grade === "red" || it.grade === "yellow" ? worse(g, it.grade) : g), "green");
    return { grade, ratio: ctx.ratio, debt: ctx.debt, items: list, results, vars: ctx.vars };
  }

  /** 규칙 하나를 입력값에 적용해 등급·이유·행동 문구를 돌려준다.
   * @param {Rule} rule
   * @param {CheckInput} input
   * @returns {RuleResult}
   */
  evaluateRule(rule, input, ctx = this.context(input)) {
    const answers = Object.entries(rule.when).map(([k, v]) => this.conditionHandlers[k](v, input, ctx));
    const hit = answers.every(a => a === true), unknown = !hit && !answers.includes(false);
    const matched = rule.when.has ? input.rights.filter(r => rule.when.has.includes(r.type)) : rule.item === "ratio" ? input.rights.filter(r => SENIOR.includes(r.type)) : [];
    const vars = { ...ctx.vars,
      items: matched.map(r => `${r.name}${r.amount ? " " + won(r.amount) : ""}`).join(", "),
      holder: (matched.find(r => r.holder) || {}).holder || "" };
    return { id: rule.id, item: rule.item, title: rule.title, grade: rule.grade, hit, unknown, matched, vars, actions: rule.actions || [] };
  }

  /** (채권최고액 합계 + 보증금) ÷ 시세 비율을 계산한다. 선순위는 근저당 채권최고액 + 앞선 전세금 + 임차권 보증금.
   * @param {CheckInput} input
   * @returns {number} 시세를 모르면 NaN
   */
  calcRatio(input) {
    const debt = this.sum(input.rights, SENIOR);
    return input.price > 0 ? (debt + (input.deposit || 0)) / input.price : NaN;
  }

  /** @private 규칙 여럿이 같이 쓰는 값 — 한 번만 센다 */
  context(input) {
    const debt = this.sum(input.rights, SENIOR), ratio = this.calcRatio(input);
    const short = n => won(n).replace(/ 원$/, "");
    return { debt, ratio, vars: {
      debt: won(debt), deposit: won(input.deposit), price: won(input.price),
      debtShort: short(debt), depositShort: short(input.deposit), priceShort: short(input.price),
      pct: Number.isFinite(ratio) ? String(Math.round(ratio * 100)) : "?",
      mortgageSum: won(this.sum(input.rights, ["mortgage"])), jeonseSum: won(this.sum(input.rights, ["jeonse"])),
      owner: input.owner || "모름", counterparty: input.counterparty || "모름" } };
  }

  /** @private */
  sum(rights, types) {
    return (rights || []).filter(r => types.includes(r.type)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }
}
