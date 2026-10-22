# 등기체크 — 클래스 설계

언어: JavaScript(빌드 없는 ES 모듈) · `core/` 에 다 있다. 아래 그림은 VYNE 가 처음 잡은 설계이고, 만들면서 바꾼 것은 맨 아래 '바꾼 것'에 적었다.

```mermaid
classDiagram
  class RegistryParser {
    +Object~string, RegExp~ patterns
    +number lastRawLength
    +parse(rawText: string) RegistryInfo
    +extractMortgages(rawText: string) Array~{creditor: string, maxAmount: number}~
    +extractSeizures(rawText: string) Array~{type: string, date: string}~
    +extractOwner(rawText: string) string
  }
  class RuleEngine {
    +Rule[] rules
    +Object~string, Function~ conditionHandlers
    +loadRules(rules: Rule[]) void
    +evaluate(input: CheckInput) CheckResult
    +evaluateRule(rule: Rule, input: CheckInput) RuleResult
    +calcRatio(input: CheckInput) number
  }
  class RuleRepository {
    +string rulesUrl
    +string glossaryUrl
    +{rules: Rule[], glossary: Object}|null cache
    +fetchRules() Promise~Rule[]~
    +fetchGlossary() Promise~Object~string, string~~
    +loadScenario(id: string) Promise~CheckInput~
  }
  class ExplanationBuilder {
    +Object~string, string~ templates
    +string disclaimer
    +buildReason(ruleResult: RuleResult) string
    +buildActions(results: RuleResult[]) string[]
    +buildReport(result: CheckResult) Report
  }
  class CheckFormView {
    +HTMLElement rootEl
    +Object~string, string~ glossary
    +Function onSubmit
    +render() void
    +fillExtracted(info: RegistryInfo) void
    +readInput() CheckInput
  }
  class ResultView {
    +HTMLElement rootEl
    +Object~string, string~ gradeColors
    +render(report: Report) void
    +renderRow(ruleResult: RuleResult) HTMLElement
    +clear() void
  }
  class App {
    +RuleRepository repo
    +RuleEngine engine
    +CheckFormView formView
    +ResultView resultView
    +init() Promise~void~
    +handleSubmit(input: CheckInput) void
    +runDemo(scenarioId: string) Promise~void~
  }
  RuleEngine ..> RuleRepository : uses
  ExplanationBuilder ..> RuleEngine : uses
  CheckFormView ..> RegistryParser : uses
  App --> RuleRepository : has
  App --> RuleEngine : has
  App --> CheckFormView : has
  App --> ResultView : has
  App ..> ExplanationBuilder : uses
```

| 클래스 | 맡은 일 | 필드 | 메서드 |
|---|---|---|---|
| `RegistryParser` | 붙여 넣은 등기부등본 글에서 근저당·가압류·소유자 항목을 자동으로 뽑는다. | patterns, lastRawLength | parse(), extractMortgages(), extractSeizures(), extractOwner() |
| `RuleEngine` | 체크리스트 규칙을 순서대로 평가해 항목별 위험·주의·양호를 낸다. | rules, conditionHandlers | loadRules(), evaluate(), evaluateRule(), calcRatio() |
| `RuleRepository` | 규칙 JSON과 용어 도움말을 불러와 코드와 데이터를 분리한다. | rulesUrl, glossaryUrl, cache | fetchRules(), fetchGlossary(), loadScenario() |
| `ExplanationBuilder` | 규칙 결과를 쉬운 말 이유 문장과 계약 전 행동 목록으로 바꾼다. | templates, disclaimer | buildReason(), buildActions(), buildReport() |
| `CheckFormView` | 등기 글 붙여 넣기와 보증금·시세 입력, 자동 추출값 수정 폼을 보여 준다. | rootEl, glossary, onSubmit | render(), fillExtracted(), readInput() |
| `ResultView` | 신호등 결과·이유·행동 목록·면책 안내를 한 화면에 보여 준다. | rootEl, gradeColors | render(), renderRow(), clear() |
| `App` | 화면·파서·엔진을 연결해 데모 흐름 전체를 실행한다. | repo, engine, formView, resultView | init(), handleSubmit(), runDemo() |

## 정한 것 · 미룬 것

- 화면(CheckFormView·ResultView)·저장(RuleRepository)·핵심 로직(RuleEngine·RegistryParser·ExplanationBuilder)을 나눴고, 규칙은 JSON으로 빼서 코드를 안 고쳐도 문구와 기준을 바꿀 수 있다.
- 등기 글은 브라우저 안에서만 처리하고 서버 전송·저장을 하지 않는다. 사용자 입력 저장소는 두지 않았다.
- 위험·주의 기준 수치(비율 등)는 규칙 JSON의 값으로 두며, 이 설계에서 임의로 정하지 않았다. 팀 체크리스트 정리 때 확정한다.
- 미룬 것: 파서의 다양한 등기 양식 대응(데모는 가상 시나리오 2개 형식만), 결과 저장·공유, 다국어.


## 바꾼 것 — 만들면서

- `RegistryParser.parse()` 가 돌려주는 `RegistryInfo` 를 `{owner, ownerIsTrustee, rights[], warnings[], cancelled[], folded[]}` 로 정했다. 부기등기(1-1 변경·1-2 이전)를 본 등기에 합치고 말소된 걸 빼는 일이 파서 안에 있어야 엔진이 '살아 있는 권리'만 보게 돼서다. `extractMortgages()` 는 순위번호·접수일도 같이 준다(결과 화면에 '을구 1번'을 보여 주려고).
- 규칙 JSON 에 `items`(화면에 보이는 점검 항목 11개와 통과 문구)를 더했다. 규칙만 있으면 '걸리지 않은 항목'을 초록으로 보여 줄 문장이 없어서다. 규칙 하나는 `item` 하나에 속하고, 한 항목의 신호등은 그 항목 규칙 가운데 가장 나쁜 등급이다(비율 80%↑ 빨강, 70~80% 노랑).
- `conditionHandlers` 는 `has · ratioAtLeast · ratioBelow · ownerMismatch · trustee · always`. 판정 함수는 참·거짓 말고 `null`(입력이 없어 모름)도 낸다 — 시세를 비워 두면 비율 항목이 '모름'(회색)이 되도록.
- `RuleRepository` 에 `fetchItems()`·`listScenarios()` 를 더하고, 생성자에 JSON 읽는 함수를 넣을 수 있게 했다(브라우저는 fetch, 시험은 파일 읽기). `loadScenario()` 는 `CheckInput` 이 아니라 시나리오(글·보증금·시세·계약 상대)를 준다 — 데모는 '붙여 넣기'부터 보여 줘야 해서.
- `ExplanationBuilder` 는 생성자에서 규칙·항목을 받아 `templates` 를 만든다(`'ratio-red'` → 이유, `'pass:ratio'` → 통과 문구).
- `CheckFormView` 는 생성자에서 `RegistryParser` 를 받는다(설계의 '씀' 관계). `setValues()`(데모·샘플 채우기)와 `onSample`·`onChange` 콜백을 더했다. 붙여 넣으면 버튼 없이 바로 뽑고, 사람이 고친 뒤 글이 바뀌면 덮어쓰지 않고 '다시 뽑기'를 묻는다.
- `ResultView` 에 `markStale()` 를 더했다 — 결과가 뜬 뒤 칸을 고치면 '옛 결과'라고 흐리게 표시한다.
- 화면 결은 애플 리퀴드 글라스(반투명 유리판·캡슐 단추·iOS 시스템 색). 투명도 줄이기·어두운 화면을 따로 챙긴다.
