/** 규칙 결과를 쉬운 말 이유 문장과 계약 전 행동 목록으로 바꾼다. */
/** @typedef {import("./RuleEngine.js").RuleEngine} RuleEngine */

export class ExplanationBuilder {
  constructor() {
    /** @type {Object<string, string>} 규칙별 문장 틀(숫자 자리 표시 포함) */
    this.templates = undefined;
    /** @type {string} 면책 안내 고정 문구 */
    this.disclaimer = undefined;
  }

  /** 판단 근거를 쉬운 말 한 문장으로 풀어쓴다.
   * @param {RuleResult} ruleResult
   * @returns {string}
   */
  buildReason(ruleResult) {
    throw new Error("TODO: 판단 근거를 쉬운 말 한 문장으로 풀어쓴다.");
  }

  /** 위험·주의 항목의 권장 행동을 중복 없이 우선순위로 모은다.
   * @param {RuleResult[]} results
   * @returns {string[]}
   */
  buildActions(results) {
    throw new Error("TODO: 위험·주의 항목의 권장 행동을 중복 없이 우선순위로 모은다.");
  }

  /** 신호등·이유·행동 목록·면책 문구를 한 묶음으로 만든다.
   * @param {CheckResult} result
   * @returns {Report}
   */
  buildReport(result) {
    throw new Error("TODO: 신호등·이유·행동 목록·면책 문구를 한 묶음으로 만든다.");
  }
}
