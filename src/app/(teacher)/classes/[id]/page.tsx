import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { compareSbd } from "@/lib/sbd";
import { requireTeacher } from "@/server/auth";
import { deleteClass, renameClass } from "@/server/teacher-actions";
import { Alert, Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { Trash2 } from "@/components/icons";
import { ClassStudents } from "./ClassStudents";

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ empty?: string }>;
}) {
  const { id } = await params;
  const { empty } = await searchParams;
  const t = await requireTeacher();
  const cls = await prisma.class.findFirst({
    where: { id, teacherId: t.id },
    include: {
      students: { include: { _count: { select: { participants: true } } } },
      _count: { select: { sessions: true } },
    },
  });
  if (!cls) notFound();
  const students = cls.students
    .map((s) => ({ id: s.id, sbd: s.sbd, used: s._count.participants > 0 }))
    .sort((a, b) => compareSbd(a.sbd, b.sbd));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: "/dashboard?tab=classes", label: "Danh sách lớp" }}
        title={cls.code}
        subtitle={`${students.length} số báo danh · ${cls._count.sessions} buổi kiểm tra`}
      />
      {empty && <Alert tone="error">Lớp chưa có số báo danh nào. Hãy thêm trước khi mở phòng.</Alert>}
      <Card className="flex flex-wrap items-end gap-3">
        <form action={renameClass.bind(null, cls.id)} className="flex min-w-64 flex-1 items-end gap-2">
          <label className="flex-1">
            <Label>Mã lớp</Label>
            <Input name="code" defaultValue={cls.code} required />
          </label>
          <Button variant="secondary" type="submit">
            Đổi tên
          </Button>
        </form>
        {cls._count.sessions === 0 && (
          <form action={deleteClass.bind(null, cls.id)}>
            <Button variant="danger" type="submit">
              <Trash2 className="h-4 w-4" aria-hidden />
              Xóa lớp
            </Button>
          </form>
        )}
      </Card>
      <ClassStudents classId={cls.id} students={students} />
    </div>
  );
}
