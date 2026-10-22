/** 붙여 넣은 등기부등본 글에서 근저당·가압류·소유자 항목을 자동으로 뽑는다. */
export class RegistryParser {
  constructor() {
    /** @type {Object<string, RegExp>} 항목별 추출용 정규식 모음 */
    this.patterns = undefined;
    /** @type {number} 마지막 입력 글자 수(디버그용, 글 내용은 저장 안 함) */
    this.lastRawLength = undefined;
  }

  /** 등기 글 전체에서 항목을 뽑아 RegistryInfo 객체로 만든다.
   * @param {string} rawText
   * @returns {RegistryInfo}
   */
  parse(rawText) {
    throw new Error("TODO: 등기 글 전체에서 항목을 뽑아 RegistryInfo 객체로 만든다.");
  }

  /** 근저당 항목의 채권자와 채권최고액을 찾아낸다.
   * @param {string} rawText
   * @returns {Array<{creditor: string, maxAmount: number}>}
   */
  extractMortgages(rawText) {
    throw new Error("TODO: 근저당 항목의 채권자와 채권최고액을 찾아낸다.");
  }

  /** 가압류·압류 같은 항목이 있는지 찾아낸다.
   * @param {string} rawText
   * @returns {Array<{type: string, date: string}>}
   */
  extractSeizures(rawText) {
    throw new Error("TODO: 가압류·압류 같은 항목이 있는지 찾아낸다.");
  }

  /** 갑구의 현재 소유자 이름을 찾아낸다.
   * @param {string} rawText
   * @returns {string}
   */
  extractOwner(rawText) {
    throw new Error("TODO: 갑구의 현재 소유자 이름을 찾아낸다.");
  }
}
