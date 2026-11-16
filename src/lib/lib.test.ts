import { describe, expect, it } from "vitest";
import { computeScore } from "./scoring";
import { parseSbdInput, compareSbd } from "./sbd";
import { seededShuffle, deriveSeed } from "./shuffle";

describe("computeScore", () => {
  const qs = [
    { id: "a", points: 1 },
    { id: "b", points: 1 },
    { id: "c", points: 2 },
  ];
  it("quy về thang 10", () => {
    expect(computeScore(qs, [{ questionId: "a", credit: 1 }, { questionId: "c", credit: 1 }])).toEqual({
      score: 7.5,
      correct: 2,
    });
  });
  it("câu sai và câu bỏ trống tính 0", () => {
    expect(computeScore(qs, [{ questionId: "a", credit: 0 }]).score).toBe(0);
  });
  it("đề rỗng không chia cho 0", () => {
    expect(computeScore([], []).score).toBe(0);
  });
  it("tính điểm một phần (câu Đúng/Sai)", () => {
    expect(computeScore(qs, [{ questionId: "c", credit: 0.5 }])).toEqual({ score: 2.5, correct: 0 });
  });
  it("làm tròn 2 chữ số", () => {
    const three = [{ id: "a", points: 1 }, { id: "b", points: 1 }, { id: "c", points: 1 }];
    expect(computeScore(three, [{ questionId: "a", credit: 1 }]).score).toBe(3.33);
  });
});

describe("parseSbdInput", () => {
  it("khoảng giữ số 0 ở đầu", () => {
    expect(parseSbdInput("001-003").values).toEqual(["001", "002", "003"]);
  });
  it("khoảng có tiền tố chữ", () => {
    expect(parseSbdInput("a08-a10").values).toEqual(["A08", "A09", "A10"]);
  });
  it("danh sách hỗn hợp, bỏ trùng", () => {
    expect(parseSbdInput("12, 13\n12;14").values).toEqual(["12", "13", "14"]);
  });
  it("báo lỗi khoảng ngược", () => {
    expect(parseSbdInput("10-2").errors).toHaveLength(1);
  });
  it("sắp xếp tự nhiên", () => {
    expect(["A10", "A2", "A1"].sort(compareSbd)).toEqual(["A1", "A2", "A10"]);
  });
});

describe("seededShuffle", () => {
  it("cùng hạt giống cho cùng kết quả", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(xs, 42)).toEqual(seededShuffle(xs, 42));
    expect(seededShuffle(xs, 42)).not.toEqual(seededShuffle(xs, 43));
    expect([...seededShuffle(xs, 42)].sort((a, b) => a - b)).toEqual(xs);
  });
  it("deriveSeed khác nhau theo khóa", () => {
    expect(deriveSeed(1, "q1")).not.toBe(deriveSeed(1, "q2"));
  });
});

import { hardestQuestions, honorRoll, questionStats, scoreSummary } from "./stats";

describe("questionStats", () => {
  const qs = [
    { id: "q1", type: "SINGLE" as const, content: "Một", options: [{ id: "a", content: "A", isCorrect: true }, { id: "b", content: "B", isCorrect: false }] },
    { id: "q2", type: "SINGLE" as const, content: "Hai", options: [{ id: "c", content: "C", isCorrect: true }] },
  ];
  it("tính tỉ lệ đúng và số người chọn từng phương án", () => {
    const r = questionStats(qs, [
      { questionId: "q1", optionId: "a", isCorrect: true, credit: 1 },
      { questionId: "q1", optionId: "b", isCorrect: false, credit: 0 },
    ]);
    expect(r[0].rate).toBe(0.5);
    expect(r[0].options.map((o) => o.picked)).toEqual([1, 1]);
    expect(r[1].rate).toBeNull();
  });
  it("câu khó nhất bỏ qua câu chưa ai trả lời", () => {
    expect(hardestQuestions([{ rate: 0.9 }, { rate: null }, { rate: 0.2 }], 2).map((q) => q.rate)).toEqual([0.2, 0.9]);
  });
});

describe("scoreSummary", () => {
  it("phổ điểm và tỉ lệ đạt", () => {
    const s = scoreSummary([10, 9.5, 4.99, 5]);
    expect(s.bins[9]).toBe(2);
    expect(s.bins[4]).toBe(1);
    expect(s.passRate).toBe(0.75);
  });
  it("không có điểm", () => {
    expect(scoreSummary([]).avg).toBeNull();
  });
});

describe("honorRoll", () => {
  it("lấy người từ 9 điểm, xếp theo SBD", () => {
    const r = honorRoll([{ sbd: "010", score: 9 }, { sbd: "002", score: 10 }, { sbd: "003", score: 8 }]);
    expect(r.kind).toBe("honor");
    expect(r.items.map((x) => x.sbd)).toEqual(["002", "010"]);
  });
  it("không ai từ 9 điểm thì lấy nhóm điểm cao nhất", () => {
    const r = honorRoll([{ sbd: "001", score: 7 }, { sbd: "002", score: 7 }, { sbd: "003", score: 6 }]);
    expect(r.kind).toBe("top");
    expect(r.items).toHaveLength(2);
  });
  it("điểm cao nhất dưới ngưỡng đạt thì không biểu dương", () => {
    expect(honorRoll([{ sbd: "001", score: 4 }]).kind).toBe("none");
  });
});

import { grade, isComplete, normalizeShort } from "./question-types";
import { shuffleWithinRuns } from "./shuffle";

describe("chấm theo dạng câu", () => {
  const tf = ["a", "b", "c", "d"].map((id, i) => ({ id, content: id, isCorrect: i % 2 === 0 }));
  it("Đúng/Sai tính theo số ý đúng: 0, 1, 2, 3, 4 ý", () => {
    const marks = (n: number) => Object.fromEntries(tf.map((o, i) => [o.id, i < n ? o.isCorrect : !o.isCorrect]));
    expect([0, 1, 2, 3, 4].map((n) => grade("TRUE_FALSE", tf, { kind: "tf", marks: marks(n) }))).toEqual([0, 0.1, 0.25, 0.5, 1]);
  });
  it("Đúng/Sai bỏ trống ý tính là sai ý đó", () => {
    expect(grade("TRUE_FALSE", tf, { kind: "tf", marks: { a: true, b: false } })).toBe(0.25);
    expect(isComplete({ kind: "tf", marks: { a: true, b: false } })).toBe(false);
  });
  it("trả lời ngắn không phân biệt hoa thường và dấu câu, giữ dấu tiếng Việt", () => {
    const opts = [{ id: "x", content: "Tuyên ngôn của Đảng Cộng sản", isCorrect: true }];
    expect(grade("SHORT", opts, { kind: "short", text: "  tuyên ngôn của đảng cộng sản. " })).toBe(1);
    expect(grade("SHORT", opts, { kind: "short", text: "“Tuyên ngôn của Đảng Cộng sản”" })).toBe(1);
    expect(grade("SHORT", opts, { kind: "short", text: "Tuyen ngon cua Dang Cong san" })).toBe(0);
    expect(grade("SHORT", opts, { kind: "short", text: "" })).toBe(0);
    expect(normalizeShort("Saint-Simon,  Fourier")).toBe("saint simon fourier");
  });
  it("trắc nghiệm", () => {
    const opts = [{ id: "a", content: "A", isCorrect: false }, { id: "b", content: "B", isCorrect: true }];
    expect(grade("SINGLE", opts, { kind: "single", optionId: "b" })).toBe(1);
    expect(grade("SINGLE", opts, { kind: "single", optionId: "a" })).toBe(0);
  });
});

describe("shuffleWithinRuns", () => {
  it("chỉ đảo trong từng phần cùng dạng", () => {
    const xs = ["S1", "S2", "S3", "S4", "T1", "T2", "T3", "H1", "H2"];
    const out = shuffleWithinRuns(xs, (x) => x[0], 7);
    expect(out.slice(0, 4).sort()).toEqual(["S1", "S2", "S3", "S4"]);
    expect(out.slice(4, 7).sort()).toEqual(["T1", "T2", "T3"]);
    expect(out.slice(7).sort()).toEqual(["H1", "H2"]);
  });
});

describe("questionStats theo dạng", () => {
  it("gộp câu trả lời ngắn theo nội dung chuẩn hóa", () => {
    const q = [{ id: "s", type: "SHORT" as const, content: "?", options: [{ id: "o", content: "1986", isCorrect: true }] }];
    const r = questionStats(q, [
      { questionId: "s", optionId: null, isCorrect: true, credit: 1, text: "1986" },
      { questionId: "s", optionId: null, isCorrect: true, credit: 1, text: "1986." },
      { questionId: "s", optionId: null, isCorrect: false, credit: 0, text: "1987" },
    ]);
    expect(r[0].responses.map((x) => [x.text, x.count, x.accepted])).toEqual([
      ["1986", 2, true],
      ["1987", 1, false],
    ]);
    expect(r[0].rate).toBeCloseTo(2 / 3);
  });
});
