/** 화면·파서·엔진을 연결해 데모 흐름 전체를 실행한다. */
/** @typedef {import("./CheckFormView.js").CheckFormView} CheckFormView */
/** @typedef {import("./ExplanationBuilder.js").ExplanationBuilder} ExplanationBuilder */
/** @typedef {import("./ResultView.js").ResultView} ResultView */
/** @typedef {import("./RuleEngine.js").RuleEngine} RuleEngine */
/** @typedef {import("./RuleRepository.js").RuleRepository} RuleRepository */

export class App {
  constructor() {
    /** @type {RuleRepository} 규칙·시나리오 로더 */
    this.repo = undefined;
    /** @type {RuleEngine} 규칙 평가 엔진 */
    this.engine = undefined;
    /** @type {CheckFormView} 입력 화면 */
    this.formView = undefined;
    /** @type {ResultView} 결과 화면 */
    this.resultView = undefined;
  }

  /** 규칙과 용어를 불러와 엔진과 화면을 준비한다.
   * @returns {Promise<void>}
   */
  init() {
    throw new Error("TODO: 규칙과 용어를 불러와 엔진과 화면을 준비한다.");
  }

  /** 엔진으로 평가하고 설명을 만들어 결과 화면에 넘긴다.
   * @param {CheckInput} input
   * @returns {void}
   */
  handleSubmit(input) {
    throw new Error("TODO: 엔진으로 평가하고 설명을 만들어 결과 화면에 넘긴다.");
  }

  /** 가상 시나리오를 폼에 채워 30초 데모를 실행한다.
   * @param {string} scenarioId
   * @returns {Promise<void>}
   */
  runDemo(scenarioId) {
    throw new Error("TODO: 가상 시나리오를 폼에 채워 30초 데모를 실행한다.");
  }
}
