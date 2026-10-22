/** 규칙 JSON과 용어 도움말을 불러와 코드와 데이터를 분리한다. */
export class RuleRepository {
  constructor() {
    /** @type {string} rules.json 경로 */
    this.rulesUrl = undefined;
    /** @type {string} 용어 도움말 JSON 경로 */
    this.glossaryUrl = undefined;
    /** @type {{rules: Rule[], glossary: Object}|null} 한 번 읽은 데이터 보관 */
    this.cache = undefined;
  }

  /** rules.json을 읽어 규칙 목록을 돌려준다.
   * @returns {Promise<Rule[]>}
   */
  fetchRules() {
    throw new Error("TODO: rules.json을 읽어 규칙 목록을 돌려준다.");
  }

  /** 용어와 쉬운 말 설명을 읽어 돌려준다.
   * @returns {Promise<Object<string, string>>}
   */
  fetchGlossary() {
    throw new Error("TODO: 용어와 쉬운 말 설명을 읽어 돌려준다.");
  }

  /** 데모용 가상 등기 시나리오를 불러온다.
   * @param {string} id
   * @returns {Promise<CheckInput>}
   */
  loadScenario(id) {
    throw new Error("TODO: 데모용 가상 등기 시나리오를 불러온다.");
  }
}
