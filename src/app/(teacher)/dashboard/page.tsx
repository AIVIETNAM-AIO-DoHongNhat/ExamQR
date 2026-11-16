import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacher } from "@/server/auth";
import { createClass, createExam, createSession } from "@/server/teacher-actions";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Label, LinkButton, PixelRule, Select, StatCard, Table, Td, Textarea, Th, Tr } from "@/components/ui";
import { ChevronRight, Play, Plus } from "@/components/icons";
import { fmtScore, fmtTime } from "@/lib/format";
import { DashboardTabs } from "@/components/DashboardTabs";

const STATUS = {
  LOBBY: { label: "Phòng chờ", tone: "gold" },
  RUNNING: { label: "Đang làm bài", tone: "red" },
  ENDED: { label: "Đã kết thúc", tone: "green" },
} as const;

const rowLink = "block font-medium text-ink transition-colors group-hover/row:text-accent";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string }> }) {
  const sp = await searchParams;
  const t = await requireTeacher();

  const [exams, classes, sessions] = await Promise.all([
    prisma.exam.findMany({
      where: { teacherId: t.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { questions: true, sessions: true } } },
    }),
    prisma.class.findMany({
      where: { teacherId: t.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { students: true, sessions: true } } },
    }),
    prisma.session.findMany({
      where: { exam: { teacherId: t.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        exam: { select: { title: true } },
        class: { select: { code: true } },
        participants: { select: { score: true } },
      },
    }),
  ]);

  const live = sessions.filter((s) => s.status !== "ENDED");
  const greeting = t.name ? `Chào đồng chí ${t.name}` : "Bảng điều khiển";

  return (
    <div className="flex flex-col gap-8">
      <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="w-fit border-2 border-ink bg-sun px-2 font-display text-[18px] font-bold tracking-widest text-ink">BẢNG ĐIỀU KHIỂN</p>
          <h1 className="mt-3 font-display text-[48px] font-bold leading-[0.95] text-ink sm:text-[58px]">{greeting}</h1>
          <PixelRule className="mt-4" />
        </div>
        <div className="grid grid-cols-3 gap-4 sm:gap-5">
          <StatCard label="Đề kiểm tra" value={exams.length} className="min-w-28" />
          <StatCard label="Lớp" value={classes.length} className="min-w-28" />
          <StatCard label="Buổi kiểm tra" value={sessions.length} tone="accent" className="min-w-28" />
        </div>
      </div>

      {live.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-[3px] border-ink bg-ink-deep px-5 py-4 text-on-dark shadow-[6px_6px_0_0_var(--color-sun)]">
          <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping bg-sun/70" />
            <span className="relative inline-flex h-3 w-3 bg-sun" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[26px] font-bold leading-none">
              {s.exam.title} · Lớp {s.class.code}
            </p>
            <p className="mt-1 text-[14px] text-on-dark-muted">
              {STATUS[s.status].label} · mã phòng <span className="font-display text-[18px] font-bold tracking-[0.12em] text-sun">{s.code}</span> · {s.participants.length} học viên đã vào
            </p>
          </div>
          <LinkButton href={`/sessions/${s.id}/present`} size="sm" variant="success">
            Mở màn chiếu
          </LinkButton>
        </div>
      ))}

      <Card className="relative bg-accent-soft">
        <span className="absolute -top-0.75 right-6 -translate-y-1/2 border-2 border-ink bg-sun px-2 font-display text-[16px] font-bold tracking-[0.08em] text-ink">MỞ NHANH</span>
        <CardHeader title="Mở phòng kiểm tra" description="Chọn đề và lớp. Hệ thống tạo mã QR để chiếu lên lớp; học viên quét mã và nhập số báo danh." />
        {sp.error && (
          <Alert tone="error" className="mb-5">
            {sp.error}
          </Alert>
        )}
        {exams.length === 0 || classes.length === 0 ? (
          <p className="text-[15px] text-muted">
            Cần có ít nhất một đề và một lớp trước khi mở phòng.{" "}
            <Link href={`/dashboard?tab=${exams.length === 0 ? "exams" : "classes"}`} className="font-medium text-accent underline-offset-4 hover:underline">
              {exams.length === 0 ? "Tạo đề" : "Tạo lớp"}
            </Link>
          </p>
        ) : (
          <form action={createSession} className="grid gap-4 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
            <label>
              <Label>Đề kiểm tra</Label>
              <Select name="examId" required>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e._count.questions} câu, {e.durationMin} phút)
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <Label>Lớp</Label>
              <Select name="classId" required>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} ({c._count.students} số báo danh)
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" size="lg">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              Mở phòng
            </Button>
          </form>
        )}
      </Card>

      <div className="flex flex-col gap-5">
        <DashboardTabs
          labels={{
            exams: `Đề kiểm tra (${exams.length})`,
            classes: `Lớp (${classes.length})`,
            sessions: `Buổi kiểm tra (${sessions.length})`,
          }}
          panels={{
          exams: (
          <section className="flex flex-col gap-4">
            <div className="flex justify-end">
              <form action={createExam}>
                <Button type="submit" variant="secondary">
                  <Plus className="h-4 w-4" aria-hidden />
                  Tạo đề mới
                </Button>
              </form>
            </div>
            {exams.length === 0 ? (
              <EmptyState title="Chưa có đề nào">Bấm “Tạo đề mới” để soạn câu hỏi trắc nghiệm. Đề tự lưu trong lúc soạn.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Tên đề</Th>
                    <Th className="text-right">Số câu</Th>
                    <Th className="text-right">Thời gian</Th>
                    <Th>Sửa lần cuối</Th>
                    <Th>Trạng thái</Th>
                    <Th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {exams.map((e) => (
                    <Tr key={e.id} className="relative">
                      <Td>
                        <Link href={`/exams/${e.id}/edit`} className={`${rowLink} after:absolute after:inset-0`}>
                          {e.title}
                        </Link>
                      </Td>
                      <Td className="text-right tabular-nums text-ink-soft">{e._count.questions}</Td>
                      <Td className="text-right tabular-nums text-ink-soft">{e.durationMin} phút</Td>
                      <Td className="whitespace-nowrap text-muted">{fmtTime(e.updatedAt)}</Td>
                      <Td>{e._count.sessions > 0 ? <Badge tone="green">Đã dùng</Badge> : <Badge>Bản nháp</Badge>}</Td>
                      <Td className="text-muted">
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
          ),
          classes: (
          <section className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
            {classes.length === 0 ? (
              <EmptyState title="Chưa có lớp nào">Tạo lớp bằng biểu mẫu bên cạnh: nhập mã lớp và khoảng số báo danh.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Mã lớp</Th>
                    <Th className="text-right">Số báo danh</Th>
                    <Th className="text-right">Buổi kiểm tra</Th>
                    <Th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <Tr key={c.id} className="relative">
                      <Td>
                        <Link href={`/classes/${c.id}`} className={`${rowLink} after:absolute after:inset-0`}>
                          {c.code}
                        </Link>
                      </Td>
                      <Td className="text-right tabular-nums text-ink-soft">{c._count.students}</Td>
                      <Td className="text-right tabular-nums text-ink-soft">{c._count.sessions}</Td>
                      <Td className="text-muted">
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Card>
              <CardHeader title="Tạo lớp" />
              <form action={createClass} className="flex flex-col gap-4">
                <label>
                  <Label>Mã lớp</Label>
                  <Input name="code" placeholder="VD: Cao cấp LLCT K75 – A2" required />
                </label>
                <label>
                  <Label>Số báo danh</Label>
                  <Textarea name="sbd" rows={4} placeholder={"001-040\nhoặc dán danh sách: 101, 102, 105"} />
                </label>
                <p className="text-[13px] leading-relaxed text-muted">Hệ thống chỉ lưu số báo danh, không lưu họ tên. Giảng viên tự đối chiếu sau buổi học qua file Excel.</p>
                <Button type="submit">Tạo lớp</Button>
              </form>
            </Card>
          </section>
          ),
          sessions: (
          <section>
            {sessions.length === 0 ? (
              <EmptyState title="Chưa có buổi kiểm tra nào">Dùng mục “Mở phòng kiểm tra” ở trên để bắt đầu buổi đầu tiên.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Thời gian</Th>
                    <Th>Đề</Th>
                    <Th>Lớp</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Tham gia</Th>
                    <Th className="text-right">Điểm TB</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const scores = s.participants.map((p) => p.score).filter((x): x is number => x != null);
                    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                    const st = STATUS[s.status];
                    return (
                      <Tr key={s.id}>
                        <Td className="whitespace-nowrap text-muted">{fmtTime(s.createdAt)}</Td>
                        <Td className="font-medium">{s.exam.title}</Td>
                        <Td className="text-ink-soft">{s.class.code}</Td>
                        <Td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Td>
                        <Td className="text-right tabular-nums text-ink-soft">{s.participants.length}</Td>
                        <Td className="text-right font-medium tabular-nums">{s.status === "ENDED" ? fmtScore(avg == null ? null : Math.round(avg * 100) / 100) : "–"}</Td>
                        <Td className="whitespace-nowrap text-right">
                          {s.status === "ENDED" ? (
                            <LinkButton href={`/sessions/${s.id}/report`} size="sm" variant="secondary">
                              Báo cáo
                            </LinkButton>
                          ) : (
                            <LinkButton href={`/sessions/${s.id}/present`} size="sm">
                              Mở màn chiếu
                            </LinkButton>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </section>
          ),
          }}
        />
      </div>
    </div>
  );
}
