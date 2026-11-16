"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";
import { parseSbdInput } from "@/lib/sbd";
import { newRoomCode } from "@/lib/code";
import { requireTeacher } from "./auth";
import { examProblems, type ExamDraft } from "@/lib/exam-validate";

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ---------------- Đề thi ---------------- */

async function ownExam(examId: string) {
  const t = await requireTeacher();
  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherId: t.id },
    include: { _count: { select: { sessions: true } } },
  });
  if (!exam) throw new Error("Không tìm thấy đề");
  return exam;
}

export async function createExam() {
  const t = await requireTeacher();
  const exam = await prisma.exam.create({
    data: {
      teacherId: t.id,
      title: "Đề mới",
      durationMin: 15,
      questions: {
        create: [
          {
            order: 0,
            content: "",
            points: 1,
            options: {
              create: [
                { order: 0, content: "", isCorrect: true },
                { order: 1, content: "", isCorrect: false },
                { order: 2, content: "", isCorrect: false },
                { order: 3, content: "", isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });
  redirect(`/exams/${exam.id}/edit`);
}

const draftSchema = z.object({
  title: z.string().trim().max(200),
  durationMin: z.number().int().min(1).max(180),
  questions: z
    .array(
      z.object({
        content: z.string().max(2000),
        points: z.number().int().min(1).max(100),
        options: z
          .array(z.object({ content: z.string().max(1000), isCorrect: z.boolean() }))
          .min(2)
          .max(6),
      }),
    )
    .max(200),
});

/** Lưu toàn bộ đề (thay thế câu hỏi). Đề đã dùng cho buổi kiểm tra thì bị khóa. */
export async function saveExam(examId: string, draft: ExamDraft) {
  const exam = await ownExam(examId);
  if (exam._count.sessions > 0) return { ok: false as const, error: "Đề đã được dùng nên bị khóa. Hãy nhân bản để sửa." };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false as const, error: "Dữ liệu đề không hợp lệ" };
  const d = parsed.data;
  await prisma.$transaction([
    prisma.question.deleteMany({ where: { examId } }),
    prisma.exam.update({
      where: { id: examId },
      data: {
        title: d.title || "Đề chưa đặt tên",
        durationMin: d.durationMin,
        questions: {
          create: d.questions.map((q, qi) => ({
            order: qi,
            content: q.content,
            points: q.points,
            options: { create: q.options.map((o, oi) => ({ order: oi, content: o.content, isCorrect: o.isCorrect })) },
          })),
        },
      },
    }),
  ]);
  return { ok: true as const, savedAt: new Date().toISOString() };
}

export async function duplicateExam(examId: string) {
  const exam = await ownExam(examId);
  const full = await prisma.exam.findUniqueOrThrow({
    where: { id: exam.id },
    include: { questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } } },
  });
  const copy = await prisma.exam.create({
    data: {
      teacherId: full.teacherId,
      title: `${full.title} (bản sao)`,
      durationMin: full.durationMin,
      questions: {
        create: full.questions.map((q) => ({
          order: q.order,
          content: q.content,
          points: q.points,
          options: { create: q.options.map((o) => ({ order: o.order, content: o.content, isCorrect: o.isCorrect })) },
        })),
      },
    },
  });
  redirect(`/exams/${copy.id}/edit`);
}

export async function deleteExam(examId: string) {
  const exam = await ownExam(examId);
  if (exam._count.sessions > 0) throw new Error("Không xóa được đề đã có buổi kiểm tra");
  await prisma.exam.delete({ where: { id: examId } });
  revalidatePath("/dashboard");
}

/* ---------------- Lớp ---------------- */

async function ownClass(classId: string) {
  const t = await requireTeacher();
  const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: t.id } });
  if (!cls) throw new Error("Không tìm thấy lớp");
  return cls;
}

export async function createClass(formData: FormData) {
  const t = await requireTeacher();
  const code = String(formData.get("code") ?? "").trim().slice(0, 80);
  if (!code) return;
  const sbd = String(formData.get("sbd") ?? "");
  const { values } = parseSbdInput(sbd);
  const cls = await prisma.class.create({
    data: { teacherId: t.id, code, students: { create: values.map((v) => ({ sbd: v })) } },
  });
  redirect(`/classes/${cls.id}`);
}

export async function renameClass(classId: string, formData: FormData) {
  await ownClass(classId);
  const code = String(formData.get("code") ?? "").trim().slice(0, 80);
  if (code) await prisma.class.update({ where: { id: classId }, data: { code } });
  revalidatePath(`/classes/${classId}`);
}

export async function addStudents(classId: string, input: string) {
  await ownClass(classId);
  const { values, errors } = parseSbdInput(input);
  const res = await prisma.student.createMany({
    data: values.map((sbd) => ({ classId, sbd })),
    skipDuplicates: true,
  });
  revalidatePath(`/classes/${classId}`);
  return { added: res.count, skipped: values.length - res.count, errors };
}

export async function removeStudent(classId: string, studentId: string) {
  await ownClass(classId);
  const used = await prisma.participant.count({ where: { studentId } });
  if (used > 0) return { ok: false as const, error: "Số báo danh này đã có bài làm, không xóa được" };
  await prisma.student.delete({ where: { id: studentId, classId } });
  revalidatePath(`/classes/${classId}`);
  return { ok: true as const };
}

export async function deleteClass(classId: string) {
  await ownClass(classId);
  const sessions = await prisma.session.count({ where: { classId } });
  if (sessions > 0) throw new Error("Không xóa được lớp đã có buổi kiểm tra");
  await prisma.class.delete({ where: { id: classId } });
  redirect("/dashboard?tab=classes");
}

/* ---------------- Mở phòng ---------------- */

export async function createSession(formData: FormData) {
  const t = await requireTeacher();
  const examId = String(formData.get("examId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const exam = await prisma.exam.findFirst({
    where: { id: examId, teacherId: t.id },
    include: { questions: { include: { options: true } } },
  });
  const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: t.id }, include: { _count: { select: { students: true } } } });
  if (!exam || !cls) redirect("/dashboard?error=" + encodeURIComponent("Chọn đề và lớp"));

  const problems = examProblems({
    title: exam.title,
    durationMin: exam.durationMin,
    questions: exam.questions.map((q) => ({ content: q.content, points: q.points, options: q.options })),
  });
  if (problems.length) redirect(`/exams/${exam.id}/edit?check=1`);
  if (cls._count.students === 0) redirect(`/classes/${cls.id}?empty=1`);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const s = await prisma.session.create({ data: { examId, classId, code: newRoomCode() } });
      redirect(`/sessions/${s.id}/present`);
    } catch (e) {
      // Trùng mã phòng: thử mã khác. Các lỗi khác (kể cả redirect) ném tiếp.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("Không tạo được mã phòng, hãy thử lại");
}
