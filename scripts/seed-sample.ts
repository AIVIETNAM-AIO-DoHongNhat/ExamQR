/**
 * Nạp dữ liệu mẫu (một đề + một lớp) từ data/sample.json cho một giáo viên.
 *   npm run seed-sample              (khi CSDL chỉ có một giáo viên)
 *   npm run seed-sample -- email@donvi.vn
 *   npm run seed-sample -- --replace   (thay đề mẫu cũ nếu đề đó chưa dùng cho buổi nào)
 * Chạy lại không tạo trùng: đề trùng tên hoặc lớp trùng mã sẽ được bỏ qua.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { examProblems, type ExamDraft } from "../src/lib/exam-validate";

type Sample = { exam: ExamDraft; class: { code: string; sbd: string[] } };

const prisma = new PrismaClient();

async function main() {
  const sample: Sample = JSON.parse(readFileSync(new URL("../data/sample.json", import.meta.url), "utf8"));
  const problems = examProblems(sample.exam);
  if (problems.length) throw new Error(`Đề mẫu chưa hợp lệ:\n${problems.join("\n")}`);

  const args = process.argv.slice(2);
  const replace = args.includes("--replace");
  const email = args.find((a) => !a.startsWith("--"));
  const teachers = await prisma.teacher.findMany(email ? { where: { email } } : undefined);
  if (teachers.length !== 1) {
    throw new Error(
      email
        ? `Không tìm thấy giáo viên ${email}`
        : `Có ${teachers.length} giáo viên, hãy chỉ rõ: npm run seed-sample -- <email>`,
    );
  }
  const t = teachers[0];

  const { exam } = sample;
  const old = await prisma.exam.findFirst({ where: { teacherId: t.id, title: exam.title }, include: { _count: { select: { sessions: true } } } });
  if (old && replace && old._count.sessions > 0) throw new Error(`Đề "${exam.title}" đã dùng cho buổi kiểm tra, không thay được`);
  if (old && replace) {
    await prisma.exam.delete({ where: { id: old.id } });
    console.log(`Đã xóa đề mẫu cũ "${exam.title}"`);
  }
  if (old && !replace) {
    console.log(`Bỏ qua đề "${exam.title}" (đã có; thêm --replace để thay)`);
  } else {
    await prisma.exam.create({
      data: {
        teacherId: t.id,
        title: exam.title,
        durationMin: exam.durationMin,
        questions: {
          create: exam.questions.map((q, order) => ({
            order,
            type: q.type,
            content: q.content,
            points: q.points,
            options: { create: q.options.map((o, i) => ({ order: i, content: o.content, isCorrect: o.isCorrect })) },
          })),
        },
      },
    });
    const count = (t: string) => exam.questions.filter((q) => q.type === t).length;
    console.log(
      `Đã tạo đề "${exam.title}": ${count("SINGLE")} trắc nghiệm, ${count("TRUE_FALSE")} Đúng/Sai, ${count("SHORT")} trả lời ngắn (${exam.durationMin} phút)`,
    );
  }

  const cls = sample.class;
  if (await prisma.class.findFirst({ where: { teacherId: t.id, code: cls.code } })) {
    console.log(`Bỏ qua lớp ${cls.code} (đã có)`);
  } else {
    await prisma.class.create({
      data: { teacherId: t.id, code: cls.code, students: { create: cls.sbd.map((sbd) => ({ sbd })) } },
    });
    console.log(`Đã tạo lớp ${cls.code} (${cls.sbd.length} số báo danh)`);
  }
  console.log(`Giáo viên: ${t.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
