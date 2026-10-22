/** 한국식 돈 글 ↔ 숫자. 집값·보증금은 '1억 5천만', '5천만', '2천5백만', '15000만', '1.5억', '150,000,000' 처럼 쓴다.
 * '1억5천'처럼 억 뒤에 만을 빼먹은 말은 만 단위로 본다(흔한 줄임말). */

const small = s => {                     // '5천' → 5000, '2천5백' → 2500, '5000' → 5000
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+)천)?(?:(\d+)백)?(?:(\d+)십)?(\d+)?$/);
  if (!m || !m.slice(1).some(Boolean)) return NaN;
  return Number(m[1] || 0) * 1000 + Number(m[2] || 0) * 100 + Number(m[3] || 0) * 10 + Number(m[4] || 0);
};

/** 글 → 원. 못 읽으면 NaN */
export function parseMoney(s) {
  const t = String(s == null ? "" : s).replace(/[\s,원]/g, "").replace(/^금/, "");
  if (!t) return NaN;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+(?:\.\d+)?)억)?(.*)$/);
  let total = m[1] ? Number(m[1]) * 1e8 : 0, rest = m[2];
  if (rest) {
    const man = rest.endsWith("만");
    if (man) rest = rest.slice(0, -1);
    const v = rest ? small(rest) : man ? 1 : NaN;
    if (Number.isNaN(v)) return NaN;
    total += man || m[1] ? v * 1e4 : v;
  }
  return total > 0 ? Math.round(total) : NaN;
}

/** 90000000 → '9천만 원', 100000000 → '1억 원', 125000000 → '1억 2,500만 원' */
export function won(n) {
  n = Math.round(Number(n) || 0);
  if (n <= 0) return "0원";
  const eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), rest = n % 1e4;
  const manText = man === 0 ? "" : man % 1000 === 0 ? `${man / 1000}천만` : `${man.toLocaleString("ko-KR")}만`;
  const txt = [eok ? `${eok}억` : "", manText].filter(Boolean).join(" ");
  return (txt || rest.toLocaleString("ko-KR")) + " 원";
}
