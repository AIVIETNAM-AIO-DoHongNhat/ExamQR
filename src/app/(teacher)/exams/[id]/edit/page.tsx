import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/server/auth";
import { ExamEditor } from "./ExamEditor";

export default async function EditExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ check?: string }>;
}) {
  const { id } = await params;
  const { check } = await searchParams;
  const t = await requireTeacher();
  const exam = await prisma.exam.findFirst({
    where: { id, teacherId: t.id },
    include: {
      _count: { select: { sessions: true } },
      questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
    },
  });
  if (!exam) notFound();

  return (
    <ExamEditor
      examId={exam.id}
      locked={exam._count.sessions > 0}
      showCheck={check === "1"}
      initial={{
        title: exam.title,
        durationMin: exam.durationMin,
        questions: exam.questions.map((q) => ({
          content: q.content,
          points: q.points,
          options: q.options.map((o) => ({ content: o.content, isCorrect: o.isCorrect })),
        })),
      }}
    />
  );
}
