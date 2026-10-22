/** 화면·파서·엔진을 연결해 데모 흐름 전체를 실행한다. */
/** @typedef {import("./CheckFormView.js").CheckFormView} CheckFormView */
/** @typedef {import("./ExplanationBuilder.js").ExplanationBuilder} ExplanationBuilder */
/** @typedef {import("./ResultView.js").ResultView} ResultView */
/** @typedef {import("./RuleEngine.js").RuleEngine} RuleEngine */
/** @typedef {import("./RuleRepository.js").RuleRepository} RuleRepository */
/** @typedef {import("./RuleEngine.js").CheckInput} CheckInput */
import { RuleRepository as Repo } from "./RuleRepository.js";
import { RuleEngine as Engine } from "./RuleEngine.js";
import { RegistryParser } from "./RegistryParser.js";
import { ExplanationBuilder as Builder } from "./ExplanationBuilder.js";
import { CheckFormView as FormView } from "./CheckFormView.js";
import { ResultView as Results } from "./ResultView.js";

export class App {
  /** @param {{form: HTMLElement, result: HTMLElement, dataBase?: string}} els */
  constructor(els) {
    this.els = els;
    /** @type {RuleRepository} 규칙·시나리오 로더 */
    this.repo = new Repo(els.dataBase || "../data/");
    /** @type {RuleEngine} 규칙 평가 엔진 */
    this.engine = new Engine();
    /** @type {CheckFormView} 입력 화면 */
    this.formView = null;
    /** @type {ResultView} 결과 화면 */
    this.resultView = null;
    /** @type {ExplanationBuilder} */
    this.builder = null;
    /** @type {import("./ExplanationBuilder.js").Report|null} 마지막 결과(데모 확인용) */
    this.lastReport = null;
  }

  /** 규칙과 용어를 불러와 엔진과 화면을 준비한다.
   * @returns {Promise<void>}
   */
  async init() {
    const [rules, items, glossary, samples] = await Promise.all([
      this.repo.fetchRules(), this.repo.fetchItems(), this.repo.fetchGlossary(), this.repo.listScenarios()]);
    this.engine.loadRules(rules);
    this.builder = new Builder(rules, items);
    this.formView = new FormView(this.els.form, new RegistryParser(), glossary);
    this.formView.onSubmit = input => this.handleSubmit(input);
    this.formView.onSample = id => this.runDemo(id, { submit: false });
    this.formView.onChange = () => this.resultView.markStale();
    this.formView.render(samples);
    this.resultView = new Results(this.els.result, glossary);
  }

  /** 엔진으로 평가하고 설명을 만들어 결과 화면에 넘긴다.
   * @param {CheckInput} input
   * @returns {void}
   */
  handleSubmit(input) {
    this.lastReport = this.builder.buildReport(this.engine.evaluate(input));
    this.resultView.render(this.lastReport);
    const h = this.els.result.querySelector("#verdict");
    if (h) { h.focus({ preventScroll: true }); h.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
  }

  /** 가상 시나리오를 폼에 채워 30초 데모를 실행한다.
   * @param {string} scenarioId
   * @param {{submit?: boolean}} [opt] submit=false 면 칸만 채우고 '확인'은 사람이 누른다
   * @returns {Promise<void>}
   */
  async runDemo(scenarioId, { submit = true } = {}) {
    const s = await this.repo.loadScenario(scenarioId);
    this.resultView.clear();
    this.formView.setValues(s);
    if (submit) { const input = this.formView.readInput(); if (input) this.handleSubmit(input); }
  }
}
