// 핵심 로직 시험 — node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RegistryParser, classify } from "../core/RegistryParser.js";
import { RuleEngine, sameName } from "../core/RuleEngine.js";
import { RuleRepository } from "../core/RuleRepository.js";
import { ExplanationBuilder } from "../core/ExplanationBuilder.js";
import { parseMoney, won } from "../core/money.js";

const data = new URL("../data/", import.meta.url);
const repo = new RuleRepository(data.href, async url => JSON.parse(await readFile(new URL(url), "utf-8")));
const rules = await repo.fetchRules(), items = await repo.fetchItems();
const scenario = id => repo.loadScenario(id);
const parser = new RegistryParser();
const engine = new RuleEngine();
engine.loadRules(rules);
const builder = new ExplanationBuilder(rules, items);

const check = (text, extra = {}) => {
  const info = parser.parse(text);
  return builder.buildReport(engine.evaluate({ rights: info.rights, owner: info.owner, ...extra }));
};
const row = (report, item) => report.rows.find(r => r.item === item);

test("돈 글 읽기 — 등기부 표기와 사람이 쓰는 줄임말", () => {
  assert.equal(parseMoney("금90,000,000원"), 90000000);
  assert.equal(parseMoney("1억 5천만"), 150000000);
  assert.equal(parseMoney("1억5천"), 150000000);
  assert.equal(parseMoney("5000만"), 50000000);
  assert.ok(Number.isNaN(parseMoney("많이")));
  assert.equal(won(90000000), "9천만 원");
  assert.equal(won(125000000), "1억 2,500만 원");
});

test("데모: 빌라 등기에서 을구 근저당 9천만과 소유자를 뽑는다", async () => {
  const s = await scenario("villa");
  const m = parser.extractMortgages(s.text);
  assert.deepEqual(m.map(x => [x.rank, x.maxAmount, x.creditor]), [["1", 90000000, "주식회사○○은행"]]);
  assert.equal(parser.extractOwner(s.text), "한○○");
  assert.deepEqual(parser.extractSeizures(s.text), []);
});

test("데모: 보증금 1억·시세 1억 5천만 → '선순위 9천만 + 보증금 1억 = 시세의 127%' 빨강, 이유와 질문", async () => {
  const s = await scenario("villa");
  const r = check(s.text, { counterparty: "한○○", deposit: parseMoney("1억"), price: parseMoney("1억 5천만") });
  assert.equal(r.grade, "red");
  const ratio = row(r, "ratio");
  assert.equal(ratio.grade, "red");
  assert.equal(ratio.headline, "선순위 9천만 + 보증금 1억 = 시세의 127%");
  assert.match(ratio.reason, /경매로 넘어가면 내 보증금이 다 남지 않을 수/);
  assert.deepEqual(ratio.ranks, ["을구 1번"]);
  assert.equal(r.rows[0].item, "ratio", "가장 위험한 줄이 맨 위");
  assert.ok(r.actions.length >= 3);
  assert.match(r.actions.join("\n"), /실제 대출 잔액/);
  assert.match(r.disclaimer, /법률 자문이 아니/);
});

test("신탁·가압류 오피스텔 — 소유자는 신탁회사, 가압류 금액까지", async () => {
  const s = await scenario("officetel");
  const info = parser.parse(s.text);
  assert.equal(info.ownerIsTrustee, true);
  assert.match(info.owner, /신탁/);
  assert.deepEqual(parser.extractSeizures(s.text).map(x => [x.type, x.amount]), [["가압류", 35000000]]);
  const r = check(s.text, { counterparty: s.counterparty, deposit: s.deposit, price: s.price });
  assert.deepEqual(r.rows.filter(x => x.grade === "red").map(x => x.item).sort(), ["owner", "seizure", "trust"]);
  assert.match(row(r, "seizure").reason, /가압류 3,500만 원/);
});

test("깨끗한 원룸은 양호 — 빨강·노랑이 하나도 없다", async () => {
  const s = await scenario("clean");
  const r = check(s.text, { counterparty: s.counterparty, deposit: s.deposit, price: s.price });
  assert.equal(r.grade, "green");
  assert.equal(r.rows.filter(x => x.grade !== "green").length, 0);
});

test("부기 변경은 금액을 바꾸고, 이전은 새 빚이 아니며, 말소된 건 빠진다", async () => {
  const s = await scenario("amended");
  const info = parser.parse(s.text);
  const m = info.rights.filter(r => r.type === "mortgage");
  assert.equal(m.length, 1, "1-2 근저당권이전이 두 번째 근저당으로 세지면 안 된다");
  assert.equal(m[0].amount, 60000000, "1-1 변경으로 1억 2천만 → 6천만");
  assert.match(m[0].holder, /캐피탈/, "1-2 이전으로 권리자가 바뀐다");
  assert.equal(info.rights.some(r => r.type === "jeonse"), false, "을구 2번 전세권은 3번에서 말소");
  assert.equal(info.rights.some(r => r.type === "provisional"), false, "갑구 2번 가압류는 3번에서 말소");
  assert.equal(info.folded.length, 2);
});

test("표 칸이 | 와 탭으로 오고 줄바꿈이 CRLF 여도 같게 읽는다", async () => {
  const s = await scenario("villa");
  const messy = s.text.replace(/ {2,}/g, "\t").replace(/\n/g, "\r\n").replace(/근저당권설정\t/, "| 근저당권설정 |\t");
  assert.equal(parser.extractMortgages(messy)[0].maxAmount, 90000000);
  assert.equal(parser.extractOwner(messy), "한○○");
});

test("등기부가 아닌 글은 경고를 남기고 빈 결과", () => {
  const info = parser.parse("안녕하세요 집 보러 갑니다");
  assert.equal(info.rights.length, 0);
  assert.match(info.warnings[0], /갑 구/);
  assert.equal(parser.lastRawLength, "안녕하세요 집 보러 갑니다".length);
});

test("권리 종류 — '가압류'는 '압류'보다 먼저, 신탁 이전은 신탁", () => {
  assert.equal(classify("가압류", ""), "provisional");
  assert.equal(classify("압류", ""), "seizure");
  assert.equal(classify("소유권이전", "신탁 수탁자 ○○신탁"), "trust");
  assert.equal(classify("임의경매개시결정", ""), "auction");
  assert.equal(classify("주택임차권", "임차보증금"), "lease");
});

test("비율 경계 — 70% 노랑, 80% 빨강, 시세를 모르면 '모름'", () => {
  const mort = [{ type: "mortgage", amount: 30000000, section: "eul", rank: "1", name: "근저당" }];
  const at = (deposit, price) => row(builder.buildReport(engine.evaluate({ rights: mort, owner: "가○", counterparty: "가○", deposit, price })), "ratio");
  assert.equal(at(40000000, 100000000).grade, "yellow");   // 70%
  assert.equal(at(39000000, 100000000).grade, "green");    // 69%
  assert.equal(at(50000000, 100000000).grade, "red");      // 80%
  const unknown = at(50000000, NaN);
  assert.equal(unknown.grade, "unknown");
  assert.match(unknown.reason, /시세를 적으면/);
});

test("가려진 이름 견주기 — 보이는 글자가 다르면 다른 사람", () => {
  assert.equal(sameName("한○○", "한지민"), true);
  assert.equal(sameName("한○○", "김지민"), false);
  assert.equal(sameName("한○○", "한지"), false);
  assert.equal(sameName("한○○", ""), null);
  const r = engine.evaluate({ rights: [], owner: "한○○", counterparty: "", deposit: 1, price: 10 });
  assert.equal(r.items.find(i => i.item === "owner").grade, "unknown");
});

test("규칙 형식 확인 — 모르는 조건이나 등급은 바로 알린다", () => {
  const e = new RuleEngine();
  assert.throws(() => e.loadRules([]), /비어/);
  assert.throws(() => e.loadRules([{ id: "x", item: "x", grade: "red", when: { foo: 1 } }]), /모르는 조건 'foo'/);
  assert.throws(() => e.loadRules([{ id: "x", item: "x", grade: "pink", when: { always: true } }]), /grade/);
});

test("행동 목록 — 빨강 먼저, 같은 문장은 한 번만, 잔금 날 할 일은 늘 마지막", async () => {
  const s = await scenario("officetel");
  const r = check(s.text, { counterparty: s.counterparty, deposit: s.deposit, price: s.price });
  assert.equal(new Set(r.actions).size, r.actions.length);
  assert.match(r.actions.at(-1), /잔금 날/);
});

test("모든 규칙 문구의 자리 표시는 엔진이 채우는 이름만 쓴다", () => {
  const known = new Set(Object.keys(engine.evaluate({ rights: [], deposit: 1, price: 2 }).vars).concat(["items", "holder"]));
  for (const t of [...rules.flatMap(r => [r.reason, ...r.actions]), ...items.flatMap(i => [i.pass, i.unknown || ""])])
    for (const [, k] of t.matchAll(/\{(\w+)\}/g)) assert.ok(known.has(k), `모르는 자리 {${k}}: ${t}`);
});
