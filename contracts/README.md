# 갈래끼리 주고받는 모양

함수 이름·API 주소·데이터 형식을 여기에 먼저 쓰고 고친다. 서버는 없다 — 모든 갈래가 브라우저 안의 같은 객체를 주고받는다.

## 권리 한 줄 — `Right` (파서 → 화면 → 엔진)

```js
{ section: "gap" | "eul",   // 갑구·을구
  rank: "1",                // 순위번호(부기는 본 등기에 합쳐져서 '1-1' 은 안 남는다)
  type: "mortgage",         // mortgage·jeonse·lease·provisional·seizure·auction·injunction·trust·preregister·other
  name: "근저당",            // 화면에 보이는 이름
  amount: 90000000,         // 원. 채권최고액·전세금·임차보증금·청구금액(없으면 0)
  holder: "주식회사○○은행",  // 권리자
  date: "2022-03-03" }      // 접수일
```

## 엔진 입력 — `CheckInput` (화면 → 엔진)

```js
{ rights: Right[], owner: "한○○", ownerIsTrustee: false, counterparty: "한지민", deposit: 100000000, price: 150000000 }
```

`price` 를 모르면 `NaN` — 비율 항목이 '모름'이 된다. 사람이 2단계에서 고친 값이 그대로 들어온다.

## 규칙 파일 — `data/rules.json`

```js
{ "items": [ { "id": "ratio", "title": "보증금이 안전한 비율인가", "pass": "… {pct}% …", "unknown": "…" } ],
  "rules": [ { "id": "ratio-red", "item": "ratio", "title": "…", "when": { "ratioAtLeast": 0.8 }, "grade": "red",
               "reason": "선순위 {debt} + 보증금 {deposit} …", "actions": ["…물어보세요."] } ] }
```

- `when` 의 키는 엔진의 `conditionHandlers` 이름이어야 한다(모르는 키면 `loadRules()` 가 바로 오류).
- 문장 속 `{…}` 자리는 `debt·deposit·price·debtShort·depositShort·priceShort·pct·mortgageSum·jeonseSum·owner·counterparty·items·holder`. 시험이 모르는 자리를 잡아낸다.
- `grade` 는 `red·yellow·info`. 걸리지 않은 항목은 초록, 입력이 없어 못 본 항목은 '모름'.

## 결과 묶음 — `Report` (설명 → 결과 화면)

```js
{ grade: "red", gradeLabel: "위험", summary: "위험 신호 1개 — …",
  rows: [ { item: "ratio", title: "…", grade: "red", headline: "선순위 9천만 + 보증금 1억 = 시세의 127%", reason: "…", ranks: ["을구 1번"] } ],
  actions: ["…"], disclaimer: "…", counts: { red: 1, yellow: 1, green: 8 } }
```
