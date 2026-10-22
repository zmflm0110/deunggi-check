/** 규칙 JSON과 용어 도움말을 불러와 코드와 데이터를 분리한다.
 * 브라우저에서는 fetch 로, 테스트(node)에서는 파일 읽기 함수를 넣어 같은 코드로 읽는다. */
/** @typedef {import("./RuleEngine.js").Rule} Rule */
/** @typedef {import("./RuleEngine.js").CheckInput} CheckInput */
/** @typedef {{id: string, title: string, pass: string, unknown?: string, headline?: string}} Item */
/** @typedef {{id: string, name: string, text: string, deposit: number, price: number, counterparty: string, demo?: boolean}} Scenario */

const fetchJson = async url => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} 를 못 읽었어요 (${res.status})`);
  return res.json();
};

export class RuleRepository {
  /** @param {string} [base] data 폴더 주소 @param {(url: string) => Promise<any>} [load] JSON 읽는 함수 */
  constructor(base = "../data/", load = fetchJson) {
    /** @type {string} rules.json 경로 */
    this.rulesUrl = base + "rules.json";
    /** @type {string} 용어 도움말 JSON 경로 */
    this.glossaryUrl = base + "glossary.json";
    /** @type {string} 가상 시나리오 JSON 경로 */
    this.scenariosUrl = base + "scenarios.json";
    /** @type {{rules: Rule[], items: Item[], glossary: Object, scenarios?: Scenario[]}|null} 한 번 읽은 데이터 보관 */
    this.cache = null;
    this.load = load;
    this.raw = {};
  }

  /** rules.json을 읽어 규칙 목록을 돌려준다.
   * @returns {Promise<Rule[]>}
   */
  async fetchRules() {
    return (await this.rulesFile()).rules;
  }

  /** 점검 항목(화면에 보이는 순서·통과 문구)을 돌려준다.
   * @returns {Promise<Item[]>}
   */
  async fetchItems() {
    return (await this.rulesFile()).items || [];
  }

  /** 용어와 쉬운 말 설명을 읽어 돌려준다.
   * @returns {Promise<Object<string, string>>}
   */
  async fetchGlossary() {
    if (!this.raw.glossary) this.raw.glossary = await this.load(this.glossaryUrl);
    this.remember();
    return this.raw.glossary;
  }

  /** 시나리오 목록(이름만 고르는 데 쓴다)
   * @returns {Promise<Scenario[]>}
   */
  async listScenarios() {
    if (!this.raw.scenarios) this.raw.scenarios = (await this.load(this.scenariosUrl)).scenarios;
    this.remember();
    return this.raw.scenarios;
  }

  /** 데모용 가상 등기 시나리오를 불러온다.
   * @param {string} id
   * @returns {Promise<Scenario>}
   */
  async loadScenario(id) {
    const list = await this.listScenarios();
    const s = list.find(x => x.id === id);
    if (!s) throw new Error(`시나리오 '${id}' 가 없어요`);
    return s;
  }

  /** @private */
  async rulesFile() {
    if (!this.raw.rules) this.raw.rules = await this.load(this.rulesUrl);
    this.remember();
    return this.raw.rules;
  }

  /** @private */
  remember() {
    const r = this.raw.rules || {};
    this.cache = { rules: r.rules || [], items: r.items || [], glossary: this.raw.glossary || {}, scenarios: this.raw.scenarios };
  }
}
