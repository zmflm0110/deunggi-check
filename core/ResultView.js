/** 신호등 결과·이유·행동 목록·면책 안내를 한 화면에 보여 준다. */
export class ResultView {
  constructor() {
    /** @type {HTMLElement} 결과가 그려질 DOM 요소 */
    this.rootEl = undefined;
    /** @type {Object<string, string>} 위험·주의·양호별 색상 클래스 */
    this.gradeColors = undefined;
  }

  /** 전체 등급과 항목별 신호등, 이유, 행동 목록을 그린다.
   * @param {Report} report
   * @returns {void}
   */
  render(report) {
    throw new Error("TODO: 전체 등급과 항목별 신호등, 이유, 행동 목록을 그린다.");
  }

  /** 항목 한 줄(신호등+이유)을 모바일에서도 보이게 만든다.
   * @param {RuleResult} ruleResult
   * @returns {HTMLElement}
   */
  renderRow(ruleResult) {
    throw new Error("TODO: 항목 한 줄(신호등+이유)을 모바일에서도 보이게 만든다.");
  }

  /** 이전 결과를 지운다.
   * @returns {void}
   */
  clear() {
    throw new Error("TODO: 이전 결과를 지운다.");
  }
}
