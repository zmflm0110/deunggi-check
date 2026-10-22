# 등기체크 — 클래스 설계

언어: JavaScript · 뼈대는 `core/` (몸통은 TODO)

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
