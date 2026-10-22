/** 체크리스트 규칙을 순서대로 평가해 항목별 위험·주의·양호를 낸다. */
/** @typedef {import("./RuleRepository.js").RuleRepository} RuleRepository */

export class RuleEngine {
  constructor() {
    /** @type {Rule[]} JSON에서 불러온 규칙 목록 */
    this.rules = undefined;
    /** @type {Object<string, Function>} 규칙 type별 조건 판정 함수 맵 */
    this.conditionHandlers = undefined;
  }

  /** JSON으로 정의한 규칙을 엔진에 넣고 형식을 확인한다.
   * @param {Rule[]} rules
   * @returns {void}
   */
  loadRules(rules) {
    throw new Error("TODO: JSON으로 정의한 규칙을 엔진에 넣고 형식을 확인한다.");
  }

  /** 모든 규칙을 순서대로 평가해 항목별 결과와 전체 등급을 만든다.
   * @param {CheckInput} input
   * @returns {CheckResult}
   */
  evaluate(input) {
    throw new Error("TODO: 모든 규칙을 순서대로 평가해 항목별 결과와 전체 등급을 만든다.");
  }

  /** 규칙 하나를 입력값에 적용해 등급·이유·행동 문구를 돌려준다.
   * @param {Rule} rule
   * @param {CheckInput} input
   * @returns {RuleResult}
   */
  evaluateRule(rule, input) {
    throw new Error("TODO: 규칙 하나를 입력값에 적용해 등급·이유·행동 문구를 돌려준다.");
  }

  /** (채권최고액 합계 + 보증금) ÷ 시세 비율을 계산한다.
   * @param {CheckInput} input
   * @returns {number}
   */
  calcRatio(input) {
    throw new Error("TODO: (채권최고액 합계 + 보증금) ÷ 시세 비율을 계산한다.");
  }
}
