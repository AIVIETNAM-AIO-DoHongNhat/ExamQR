/** Kiểm tra bổ sung các trường hợp biên của logic chấm điểm, kiểm tra đề và vào phòng. */
import { describe, expect, it } from "vitest";
import { computeScore } from "./scoring";
import { matchSbd, parseSbdInput } from "./sbd";
import { seededShuffle, shuffleWithinRuns } from "./shuffle";
import { examProblems, type ExamDraft } from "./exam-validate";
import { creditOf, grade, isComplete, normalizeShort, responseFromRow } from "./question-types";

describe("matchSbd", () => {
  const roster = ["001", "015", "150", "A01", "0015x"].map((sbd, i) => ({ id: String(i), sbd }));
  it("khớp chính xác, không phân biệt hoa thường và khoảng trắng", () => {
    expect(matchSbd(roster, " a01 ")?.sbd).toBe("A01");
    expect(matchSbd(roster, "015")?.sbd).toBe("015");
  });
  it("chấp nhận khi học viên bỏ số 0 ở đầu", () => {
    expect(matchSbd(roster, "15")?.sbd).toBe("015");
    expect(matchSbd(roster, "1")?.sbd).toBe("001");
    expect(matchSbd(roster, "0150")?.sbd).toBe("150");
  });
  it("không đoán khi mơ hồ hoặc không có", () => {
    const amb = [{ sbd: "015" }, { sbd: "0015" }];
    expect(matchSbd(amb, "15")).toBeNull();
    expect(matchSbd(amb, "015")?.sbd).toBe("015"); // khớp chính xác vẫn ưu tiên
    expect(matchSbd(roster, "999")).toBeNull();
    expect(matchSbd(roster, "")).toBeNull();
    expect(matchSbd(roster, "A1")).toBeNull(); // có chữ cái thì phải gõ đúng
  });
});

describe("parseSbdInput – biên", () => {
  it("báo lỗi khoảng quá lớn và ký tự lạ", () => {
    expect(parseSbdInput("1-1000").errors).toHaveLength(1);
    expect(parseSbdInput("12#").errors).toHaveLength(1);
  });
  it("chuẩn hóa chữ hoa để khớp với số học viên nhập", () => {
    expect(parseSbdInput("a1 A1").values).toEqual(["A1"]);
  });
});

describe("grade – dữ liệu lệch dạng không được tính điểm", () => {
  const single = [{ id: "a", content: "A", isCorrect: true }];
  it("gửi sai kiểu câu trả lời", () => {
    expect(grade("SINGLE", single, { kind: "short", text: "A" })).toBe(0);
    expect(grade("TRUE_FALSE", single, { kind: "single", optionId: "a" })).toBe(0);
    expect(grade("SHORT", single, { kind: "single", optionId: "a" })).toBe(0);
  });
  it("trắc nghiệm chọn id không thuộc câu", () => {
    expect(grade("SINGLE", single, { kind: "single", optionId: "zzz" })).toBe(0);
  });
  it("Đúng/Sai: đánh tất cả Đúng chỉ được theo số ý đúng thật", () => {
    const tf = ["a", "b", "c", "d"].map((id, i) => ({ id, content: id, isCorrect: i < 3 }));
    expect(grade("TRUE_FALSE", tf, { kind: "tf", marks: { a: true, b: true, c: true, d: true } })).toBe(0.5);
    expect(grade("TRUE_FALSE", tf, { kind: "tf", marks: {} })).toBe(0);
  });
  it("trả lời ngắn: đáp án được chấp nhận để trống không làm câu trống thành đúng", () => {
    const opts = [{ id: "x", content: "", isCorrect: true }, { id: "y", content: "Hà Nội", isCorrect: true }];
    expect(grade("SHORT", opts, { kind: "short", text: "   " })).toBe(0);
    expect(grade("SHORT", opts, { kind: "short", text: "..." })).toBe(0);
    expect(grade("SHORT", opts, { kind: "short", text: "hà nội" })).toBe(1);
  });
  it("trả lời ngắn: chuẩn hóa Unicode tổ hợp (gõ dấu kiểu cũ)", () => {
    const decomposed = "Hà Nội"; // "Hà Nội" dạng NFD
    expect(normalizeShort(decomposed)).toBe(normalizeShort("Hà Nội"));
  });
});

describe("isComplete / responseFromRow / creditOf", () => {
  it("isComplete theo dạng", () => {
    expect(isComplete(undefined)).toBe(false);
    expect(isComplete({ kind: "single", optionId: "a" })).toBe(true);
    expect(isComplete({ kind: "short", text: "  " })).toBe(false);
    expect(isComplete({ kind: "tf", marks: { a: true, b: true, c: false, d: false } })).toBe(true);
  });
  it("đọc lại bản ghi đã lưu", () => {
    expect(responseFromRow("SINGLE", { optionId: null, text: null, marks: null })).toBeNull();
    expect(responseFromRow("SHORT", { optionId: null, text: "", marks: null })).toEqual({ kind: "short", text: "" });
    expect(responseFromRow("TRUE_FALSE", { optionId: null, text: null, marks: { a: false } })).toEqual({ kind: "tf", marks: { a: false } });
  });
  it("bản ghi cũ chưa có credit dùng isCorrect", () => {
    expect(creditOf({ credit: null, isCorrect: true })).toBe(1);
    expect(creditOf({ credit: 0.25, isCorrect: false })).toBe(0.25);
  });
});

describe("computeScore – đề hỗn hợp", () => {
  it("12 TN (1đ) + 4 Đ/S (2đ) + 6 TL (1đ): đúng hết được 10", () => {
    const qs = [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, points: 1 })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, points: 2 })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, points: 1 })),
    ];
    expect(computeScore(qs, qs.map((q) => ({ questionId: q.id, credit: 1 })))).toEqual({ score: 10, correct: 22 });
    // Mỗi câu Đ/S đúng 3 ý (0,5) và không làm gì khác: 4 × 2 × 0,5 = 4 / 26 điểm
    const r = computeScore(qs, qs.filter((q) => q.id.startsWith("t")).map((q) => ({ questionId: q.id, credit: 0.5 })));
    expect(r).toEqual({ score: 1.54, correct: 0 });
  });
  it("bỏ qua câu trả lời của câu không còn trong đề", () => {
    expect(computeScore([{ id: "a", points: 1 }], [{ questionId: "ghost", credit: 1 }]).score).toBe(0);
  });
});

describe("examProblems", () => {
  const base = (q: Partial<ExamDraft["questions"][number]>): ExamDraft => ({
    title: "x",
    durationMin: 10,
    questions: [{ type: "SINGLE", content: "?", points: 1, options: [{ content: "A", isCorrect: true }, { content: "B", isCorrect: false }], ...q }],
  });
  it("đề hợp lệ", () => expect(examProblems(base({}))).toEqual([]));
  it("đề rỗng", () => expect(examProblems({ title: "", durationMin: 5, questions: [] })).toHaveLength(1));
  it("trắc nghiệm có 0 hoặc 2 đáp án đúng", () => {
    expect(examProblems(base({ options: [{ content: "A", isCorrect: false }, { content: "B", isCorrect: false }] }))).toHaveLength(1);
    expect(examProblems(base({ options: [{ content: "A", isCorrect: true }, { content: "B", isCorrect: true }] }))).toHaveLength(1);
  });
  it("Đúng/Sai thiếu nhận định", () => {
    expect(examProblems(base({ type: "TRUE_FALSE", options: [{ content: "a", isCorrect: true }] }))[0]).toMatch(/4 nhận định/);
  });
  it("trả lời ngắn không có đáp án", () => {
    expect(examProblems(base({ type: "SHORT", options: [{ content: " ", isCorrect: true }] }))).toHaveLength(1);
  });
});

describe("đảo đề", () => {
  it("là hoán vị, ổn định khi tải lại, khác nhau giữa học viên", () => {
    const xs = Array.from({ length: 30 }, (_, i) => i);
    const a = seededShuffle(xs, 123);
    expect([...a].sort((x, y) => x - y)).toEqual(xs);
    expect(seededShuffle(xs, 123)).toEqual(a);
    expect(seededShuffle(xs, 124)).not.toEqual(a);
  });
  it("phần cùng dạng tách rời (TN → Đ/S → TN) vẫn giữ thứ tự phần", () => {
    const xs = ["S1", "S2", "T1", "T2", "S3", "S4"];
    const out = shuffleWithinRuns(xs, (x) => x[0], 99);
    expect(out.map((x) => x[0])).toEqual(["S", "S", "T", "T", "S", "S"]);
    expect(out.slice(4).sort()).toEqual(["S3", "S4"]);
  });
  it("đề rỗng và một câu", () => {
    expect(shuffleWithinRuns([], (x: string) => x, 1)).toEqual([]);
    expect(shuffleWithinRuns(["a"], (x) => x, 1)).toEqual(["a"]);
  });
});
