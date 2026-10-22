/** 규칙 결과를 쉬운 말 이유 문장과 계약 전 행동 목록으로 바꾼다. */
/** @typedef {import("./RuleEngine.js").RuleEngine} RuleEngine */
/** @typedef {import("./RuleEngine.js").RuleResult} RuleResult */
/** @typedef {import("./RuleEngine.js").CheckResult} CheckResult */
/** @typedef {import("./RuleRepository.js").Item} Item */
/** @typedef {{item: string, title: string, grade: string, headline: string, reason: string, ranks: string[]}} ReportRow */
/** @typedef {{grade: string, gradeLabel: string, summary: string, rows: ReportRow[], actions: string[], disclaimer: string, counts: Object<string, number>}} Report */

export const GRADE_LABEL = { red: "위험", yellow: "주의", green: "양호", unknown: "모름", info: "할 일" };
const ORDER = { red: 0, yellow: 1, unknown: 2, green: 3, info: 4 };

/** '{debt}' 자리에 값을 넣는다. 값이 없는 자리는 그대로 두지 않고 '모름'으로 */
export const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null && vars[k] !== "" ? vars[k] : "모름"));

export class ExplanationBuilder {
  /** @param {import("./RuleEngine.js").Rule[]} rules @param {Item[]} items */
  constructor(rules = [], items = []) {
    /** @type {Object<string, string>} 규칙별 문장 틀(숫자 자리 표시 포함) — 'ratio-red' → 이유, 'pass:ratio' → 통과 문구 */
    this.templates = {};
    for (const r of rules) this.templates[r.id] = r.reason;
    for (const it of items) {
      this.templates[`pass:${it.id}`] = it.pass;
      if (it.unknown) this.templates[`unknown:${it.id}`] = it.unknown;
    }
    this.items = items;
    /** @type {string} 면책 안내 고정 문구 */
    this.disclaimer = "등기체크는 붙여 넣은 글을 정해진 체크리스트로 읽어 본 참고용 결과예요. 법률 자문이 아니고, 실제 대출 잔액·세금 체납·선순위 임차인은 등기부에 안 나와요. 계약 전에 공인중개사에게 확인하고, 큰돈이면 법무사 상담을 받으세요.";
  }

  /** 판단 근거를 쉬운 말 한 문장으로 풀어쓴다.
   * @param {RuleResult} ruleResult
   * @returns {string}
   */
  buildReason(ruleResult) {
    return fill(this.templates[ruleResult.id], ruleResult.vars);
  }

  /** 위험·주의 항목의 권장 행동을 중복 없이 우선순위로 모은다(빨강 → 노랑 → 늘 할 일).
   * @param {RuleResult[]} results
   * @returns {string[]}
   */
  buildActions(results) {
    const hits = results.filter(r => r.hit).sort((a, b) => ORDER[a.grade] - ORDER[b.grade]);
    return [...new Set(hits.flatMap(r => r.actions.map(a => fill(a, r.vars))))];
  }

  /** 신호등·이유·행동 목록·면책 문구를 한 묶음으로 만든다.
   * @param {CheckResult} result
   * @returns {Report}
   */
  buildReport(result) {
    const order = this.items.map(i => i.id);
    const rows = result.items
      .filter(it => it.grade !== "info")
      .map(it => {
        const vars = it.rule ? it.rule.vars : (result.results.find(r => r.item === it.item) || {}).vars || result.vars;
        const reason = it.grade === "red" || it.grade === "yellow" ? this.buildReason(it.rule)
          : it.grade === "unknown" ? fill(this.templates[`unknown:${it.item}`] || "입력이 모자라 판단하지 못했어요.", vars)
          : fill(this.templates[`pass:${it.item}`], vars);
        const meta = this.items.find(i => i.id === it.item) || {};
        return { item: it.item, title: meta.title || (it.rule && it.rule.title) || it.item, grade: it.grade,
                 headline: it.item === "ratio" && Number.isFinite(result.ratio)
                   ? fill("선순위 {debtShort} + 보증금 {depositShort} = 시세의 {pct}%", result.vars) : "",
                 reason, ranks: it.matched.map(r => `${r.section === "gap" ? "갑구" : "을구"} ${r.rank}번`) };
      })
      .sort((a, b) => ORDER[a.grade] - ORDER[b.grade] || order.indexOf(a.item) - order.indexOf(b.item));
    const counts = rows.reduce((c, r) => ({ ...c, [r.grade]: (c[r.grade] || 0) + 1 }), {});
    const summary = result.grade === "red" ? `위험 신호 ${counts.red}개 — 이대로 계약하면 보증금을 잃을 수 있어요.`
      : result.grade === "yellow" ? `주의할 것 ${counts.yellow}개 — 계약 전에 꼭 확인하세요.`
      : counts.unknown ? `걸린 위험 신호는 없지만, ${counts.unknown}개 항목은 입력이 모자라 못 봤어요.`
      : "체크리스트에 걸린 위험 신호가 없어요.";
    return { grade: result.grade, gradeLabel: GRADE_LABEL[result.grade], summary, rows,
             actions: this.buildActions(result.results), disclaimer: this.disclaimer, counts };
  }
}
