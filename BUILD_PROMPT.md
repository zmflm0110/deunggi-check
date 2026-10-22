# '등기체크' 만들기

이 폴더에서 '등기체크'를 만든다. 아래는 VYNE 아이디어 은행에서 정한 안이다 — 무엇을 왜 만드는지의 기준으로 삼고, 적혀 있지 않은 기능은 더하지 않는다. 폴더가 비어 있으면 `git init` 부터 한다.
칸끼리 어긋나면 끝났다는 기준 > 사용자 흐름 > 설계 > 순서(할 일) 차례로 따르고, 어긋난 곳은 `docs/DESIGN.md` 에 한 줄 남긴다.

## 왜 만드나

- 한 줄: 등기부등본의 근저당·가압류 항목을 체크리스트 규칙으로 점검해 계약 직전 위험 신호를 쉬운 말로 알려 주는 웹 도구.
- 누구의 어떤 불편: 처음 계약하는 사회초년생이 계약 직전 등기부등본의 근저당·가압류 항목을 봐도 위험한지 판단하지 못해 막힌다.
- 쓰는 사람: 사회초년생 직장인

애매한 결정은 이 사람이 이 불편에서 빨리 벗어나는 쪽으로 고른다.

## 사용자 흐름

1. 입력 — 인터넷등기소에서 열람한 등기부등본 글을 통째로 붙여 넣고 보증금과 시세(대략)를 적는다 — 근저당·가압류·소유자 같은 항목은 자동으로 뽑고, 사람이 보고 고칠 수 있다. 글은 기기 밖으로 안 나간다
2. 처리 — 미리 정의한 체크리스트 규칙엔진이 항목별 규칙(가압류 존재, 채권최고액과 보증금 합계의 시세 대비 비율, 소유자 불일치 등)을 순서대로 평가해 위험·주의·양호로 분류한다.
3. 출력 — 항목별 신호등 결과, 그렇게 판단한 이유를 쉬운 말로 풀어쓴 문장, 계약 전 확인할 행동 목록(예: 중개사에게 물어볼 질문)을 한 화면에 보여 준다.

## 끝났다는 기준 — 이 장면이 실제로 돈다

샘플 등기부등본 글을 붙여 넣으면 을구의 근저당(채권최고액 9천만 원)과 소유자가 뽑혀 나오고, 보증금 1억·시세 1억 5천만을 넣고 '확인'을 누르면 '선순위 9천만 + 보증금 1억 = 시세의 127% — 빨강'과 그 이유, 중개사에게 물어볼 질문이 뜬다

이 장면을 처음부터 끝까지 손으로 재현할 수 있어야 끝이다. 재현한 방법을 README 의 '데모' 칸에 적는다.

## 설계 — 출발점

언어: JavaScript — 빌드 없는 ES 모듈(브라우저에서 바로 열림)

- `RegistryParser` — 붙여 넣은 등기부등본 글에서 근저당·가압류·소유자 항목을 자동으로 뽑는다.
  - 필드: `patterns: Object<string, RegExp>`, `lastRawLength: number`
  - `parse(rawText: string) → RegistryInfo` — 등기 글 전체에서 항목을 뽑아 RegistryInfo 객체로 만든다.
  - `extractMortgages(rawText: string) → Array<{creditor: string, maxAmount: number}>` — 근저당 항목의 채권자와 채권최고액을 찾아낸다.
  - `extractSeizures(rawText: string) → Array<{type: string, date: string}>` — 가압류·압류 같은 항목이 있는지 찾아낸다.
  - `extractOwner(rawText: string) → string` — 갑구의 현재 소유자 이름을 찾아낸다.
- `RuleEngine` — 체크리스트 규칙을 순서대로 평가해 항목별 위험·주의·양호를 낸다.
  - 필드: `rules: Rule[]`, `conditionHandlers: Object<string, Function>`
  - `loadRules(rules: Rule[]) → void` — JSON으로 정의한 규칙을 엔진에 넣고 형식을 확인한다.
  - `evaluate(input: CheckInput) → CheckResult` — 모든 규칙을 순서대로 평가해 항목별 결과와 전체 등급을 만든다.
  - `evaluateRule(rule: Rule, input: CheckInput) → RuleResult` — 규칙 하나를 입력값에 적용해 등급·이유·행동 문구를 돌려준다.
  - `calcRatio(input: CheckInput) → number` — (채권최고액 합계 + 보증금) ÷ 시세 비율을 계산한다.
  - 씀 `RuleRepository`
- `RuleRepository` — 규칙 JSON과 용어 도움말을 불러와 코드와 데이터를 분리한다.
  - 필드: `rulesUrl: string`, `glossaryUrl: string`, `cache: {rules: Rule[], glossary: Object}|null`
  - `fetchRules() → Promise<Rule[]>` — rules.json을 읽어 규칙 목록을 돌려준다.
  - `fetchGlossary() → Promise<Object<string, string>>` — 용어와 쉬운 말 설명을 읽어 돌려준다.
  - `loadScenario(id: string) → Promise<CheckInput>` — 데모용 가상 등기 시나리오를 불러온다.
- `ExplanationBuilder` — 규칙 결과를 쉬운 말 이유 문장과 계약 전 행동 목록으로 바꾼다.
  - 필드: `templates: Object<string, string>`, `disclaimer: string`
  - `buildReason(ruleResult: RuleResult) → string` — 판단 근거를 쉬운 말 한 문장으로 풀어쓴다.
  - `buildActions(results: RuleResult[]) → string[]` — 위험·주의 항목의 권장 행동을 중복 없이 우선순위로 모은다.
  - `buildReport(result: CheckResult) → Report` — 신호등·이유·행동 목록·면책 문구를 한 묶음으로 만든다.
  - 씀 `RuleEngine`
- `CheckFormView` — 등기 글 붙여 넣기와 보증금·시세 입력, 자동 추출값 수정 폼을 보여 준다.
  - 필드: `rootEl: HTMLElement`, `glossary: Object<string, string>`, `onSubmit: Function`
  - `render() → void` — 입력창, 추출 항목 수정칸, 용어 툴팁을 그린다.
  - `fillExtracted(info: RegistryInfo) → void` — 자동으로 뽑은 값을 수정 가능한 칸에 채워 넣는다.
  - `readInput() → CheckInput` — 폼 값을 숫자 변환해 CheckInput으로 읽어 온다.
  - 씀 `RegistryParser`
- `ResultView` — 신호등 결과·이유·행동 목록·면책 안내를 한 화면에 보여 준다.
  - 필드: `rootEl: HTMLElement`, `gradeColors: Object<string, string>`
  - `render(report: Report) → void` — 전체 등급과 항목별 신호등, 이유, 행동 목록을 그린다.
  - `renderRow(ruleResult: RuleResult) → HTMLElement` — 항목 한 줄(신호등+이유)을 모바일에서도 보이게 만든다.
  - `clear() → void` — 이전 결과를 지운다.
- `App` — 화면·파서·엔진을 연결해 데모 흐름 전체를 실행한다.
  - 필드: `repo: RuleRepository`, `engine: RuleEngine`, `formView: CheckFormView`, `resultView: ResultView`
  - `init() → Promise<void>` — 규칙과 용어를 불러와 엔진과 화면을 준비한다.
  - `handleSubmit(input: CheckInput) → void` — 엔진으로 평가하고 설명을 만들어 결과 화면에 넘긴다.
  - `runDemo(scenarioId: string) → Promise<void>` — 가상 시나리오를 폼에 채워 30초 데모를 실행한다.
  - 가짐 `RuleRepository`, 가짐 `RuleEngine`, 가짐 `CheckFormView`, 가짐 `ResultView`, 씀 `ExplanationBuilder`

설계에서 정한 것·미룬 것:
- 화면(CheckFormView·ResultView)·저장(RuleRepository)·핵심 로직(RuleEngine·RegistryParser·ExplanationBuilder)을 나눴고, 규칙은 JSON으로 빼서 코드를 안 고쳐도 문구와 기준을 바꿀 수 있다.
- 등기 글은 브라우저 안에서만 처리하고 서버 전송·저장을 하지 않는다. 사용자 입력 저장소는 두지 않았다.
- 위험·주의 기준 수치(비율 등)는 규칙 JSON의 값으로 두며, 이 설계에서 임의로 정하지 않았다. 팀 체크리스트 정리 때 확정한다.
- 미룬 것: 파서의 다양한 등기 양식 대응(데모는 가상 시나리오 2개 형식만), 결과 저장·공유, 다국어.

화면·저장·핵심 로직을 다른 클래스로 둔 건 핵심 로직을 화면 없이 테스트하려는 것이다. 더 나은 모양이 보이면 바꿔도 된다 — 바꾸면 `docs/DESIGN.md` 에 무엇을 왜 바꿨는지 한 줄씩 남긴다.

## 순서

먼저 흐름 전체를 얇게 잇는다 — 바깥 서비스는 가짜(고정 응답)로 두고, 입력에서 출력까지 한 번 돌게. 그다음 아래 단계를 차례로 두껍게 만든다. 단계마다 테스트를 돌려 통과시키고 작게 커밋한다. 시간은 비중이다.

1. **규칙 설계** (약 6시간)
   - 근저당·가압류·소유자 일치 등 점검 항목과 위험 판정 규칙을 체크리스트로 정리
   - 각 규칙의 쉬운 말 설명과 권장 행동 문구 작성
   - 규칙을 JSON 데이터로 정의해 코드와 분리
2. **규칙엔진 구현** (약 7시간)
   - 입력값을 받아 규칙을 평가하고 위험·주의·양호를 내는 엔진 구현
   - 규칙별 단위 테스트와 가상의 예시 케이스 3개로 검증
3. **화면 제작** (약 7시간)
   - 등기 정보 입력 폼과 용어 도움말 툴팁 제작
   - 신호등 결과, 이유, 행동 목록 결과 화면 제작
   - 모바일 화면 대응
4. **다듬기와 발표 준비** (약 4시간)
   - 데모용 가상 등기 시나리오 2개 준비
   - 문구 다듬기와 면책 안내 추가
   - 30초 데모 리허설

## 위험과 모르는 것 — 먼저 확인한다

- 위험: 등기부 해석 오류 — 등기부등본 샘플 몇 장으로 근저당·가압류 항목을 뽑아 보여주는 프로토타입을 만들고 법무사나 경험자에게 검수받는다.
- 확인할 것: 근저당·보증금 대비 시세 비율에 쓸 위험 임계값의 신뢰할 만한 근거(공식 자료나 전문가 의견)
- 확인할 것: 등기부등본 PDF를 자동으로 읽는 기능이 필요한지(OCR이나 LLM이 필요해 보이면 별도 검토), 아니면 직접 입력으로 충분한지
- 확인할 것: 시세 정보를 어디서 얻을지(사용자 직접 입력 외에 쓸 수 있는 무료 공공 자료가 있는지)

위험한 것부터 작은 실험으로 확인한다. 안 되면 더 단순한 방법으로 바꾸고 그 사실을 README 에 남긴다.

## 일하는 방식

- 바깥 API·라이브러리 이름, 요금, 데이터 같은 사실은 지어내지 않는다. 모르면 `NOTES.md` 에 적고 가정한 채로 이어 간다.
- 바깥 서비스는 클래스 하나 뒤에 두고, 테스트에선 가짜로 바꿔 끼운다.
- 비밀 키는 `.env` 에만 두고 `.gitignore` 에 넣는다. 코드·커밋·README 에 키를 쓰지 않는다.
- 정해진 대로 할 수 있는 결정은 묻지 않고 진행한다. 돈이 드는 키, 계정 만들기처럼 사람만 할 수 있는 일에서만 멈추고 묻는다.
- 끝났다고 하기 전에 실제로 돌려 본다. 돌려 보지 못한 건 못 했다고 쓴다.

## 다 됐는지

- [ ] 끝났다는 기준의 장면을 손으로 재현했다
- [ ] 핵심 로직 테스트가 있고 통과한다
- [ ] README 맨 위에 한 줄 설명과 실행 방법이 있다
- [ ] 비밀 키가 코드·커밋에 없다

## 끝나면 짧게 보고

만든 것 / 설계와 달라진 것과 이유 / 못 한 것과 가정한 것 / 다음에 할 일 — 각각 몇 줄로.
