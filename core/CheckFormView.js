/** 등기 글 붙여 넣기와 보증금·시세 입력, 자동 추출값 수정 폼을 보여 준다. */
/** @typedef {import("./RegistryParser.js").RegistryParser} RegistryParser */

export class CheckFormView {
  constructor() {
    /** @type {HTMLElement} 폼이 그려질 DOM 요소 */
    this.rootEl = undefined;
    /** @type {Object<string, string>} 툴팁에 쓸 용어 설명 */
    this.glossary = undefined;
    /** @type {Function} 제출 시 호출할 콜백 */
    this.onSubmit = undefined;
  }

  /** 입력창, 추출 항목 수정칸, 용어 툴팁을 그린다.
   * @returns {void}
   */
  render() {
    throw new Error("TODO: 입력창, 추출 항목 수정칸, 용어 툴팁을 그린다.");
  }

  /** 자동으로 뽑은 값을 수정 가능한 칸에 채워 넣는다.
   * @param {RegistryInfo} info
   * @returns {void}
   */
  fillExtracted(info) {
    throw new Error("TODO: 자동으로 뽑은 값을 수정 가능한 칸에 채워 넣는다.");
  }

  /** 폼 값을 숫자 변환해 CheckInput으로 읽어 온다.
   * @returns {CheckInput}
   */
  readInput() {
    throw new Error("TODO: 폼 값을 숫자 변환해 CheckInput으로 읽어 온다.");
  }
}
