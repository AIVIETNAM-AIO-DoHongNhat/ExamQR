import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacher } from "@/server/auth";
import { loadReport } from "@/server/report";
import { brand, brandLine } from "@/lib/brand";
import { fmtScore, fmtTime } from "@/lib/format";
import { PASS_SCORE } from "@/lib/stats";
import { STATEMENT_LABELS, TYPE_LABEL } from "@/lib/question-types";
import { ShortResponses } from "./ShortResponses";
import { PrintButton } from "@/components/PrintButton";
import { ScoreHistogram } from "@/components/ScoreHistogram";
import { Download } from "@/components/icons";
import { Badge, Card, CardHeader, LinkButton, PageHeader, StatCard, Table, Td, Th, Tr, buttonClass, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

const LETTERS = "ABCDEF";
const fmtDur = (s: number | null) => (s == null ? "–" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const pct = (r: number | null) => (r == null ? "–" : `${Math.round(r * 100)}%`);

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const { sort } = await searchParams;
  const t = await requireTeacher();
  const r = await loadReport(id, t.id);
  if (!r) notFound();
  const { session: s, rows, stats } = r;
  const hardFirst = sort === "hard";
  const questions = hardFirst ? [...r.questions].sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2)) : r.questions;

  return (
    <div className="flex flex-col gap-8">
      {/* Tiêu đề khi in */}
      <div className="print-only border-b border-ink pb-3 text-center">
        {brand.orgName && <p className="text-sm font-medium uppercase tracking-wider">{brand.orgName}</p>}
        {brand.orgUnit && <p className="text-sm">{brand.orgUnit}</p>}
        <p className="mt-2 font-display text-lg font-semibold">Báo cáo kết quả bài kiểm tra</p>
      </div>

      <PageHeader
        back={{ href: "/dashboard?tab=sessions", label: "Buổi kiểm tra" }}
        title={s.exam.title}
        subtitle={
          <>
            Lớp {s.class.code} · mã phòng <span className="font-display text-[18px] font-bold tracking-[0.1em] text-accent">{s.code}</span> · {fmtTime(s.startedAt ?? s.createdAt)}
          </>
        }
        actions={
          <>
            {s.status !== "ENDED" && (
              <LinkButton href={`/sessions/${s.id}/present`} variant="secondary">
                Mở màn chiếu
              </LinkButton>
            )}
            <PrintButton />
            <a href={`/api/sessions/${s.id}/export`} className={buttonClass("primary")}>
              <Download className="h-4 w-4" aria-hidden />
              Xuất Excel
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Tham gia" value={stats.present} sub={`trên ${stats.total} số báo danh`} />
        <StatCard label="Điểm trung bình" tone="accent" value={fmtScore(stats.avg == null ? null : Math.round(stats.avg * 100) / 100)} />
        <StatCard label={`Tỉ lệ đạt (từ ${PASS_SCORE} điểm)`} value={pct(stats.passRate)} />
        <StatCard label="Cao nhất" value={fmtScore(stats.max)} />
        <StatCard label="Thấp nhất" value={fmtScore(stats.min)} />
      </div>

      <Card className="print-break-avoid">
        <CardHeader
          title="Phổ điểm"
          action={
            <span className="flex items-center gap-4 text-[13px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 border-2 border-ink bg-accent" /> Đạt
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 border-2 border-ink bg-paper" /> Chưa đạt
              </span>
            </span>
          }
        />
        <ScoreHistogram bins={stats.bins} className="h-48" />
      </Card>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-[30px] font-bold leading-none text-ink">Bảng điểm theo số báo danh</h2>
          <Table>
            <thead>
              <tr>
                <Th>SBD</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Đã làm</Th>
                <Th className="text-right">Đúng</Th>
                <Th className="text-right">Điểm</Th>
                <Th className="text-right">Thời gian</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.sbd} className={cx(!row.present && "text-muted")}>
                  <Td className="font-mono">{row.sbd}</Td>
                  <Td>{!row.present ? <Badge>Vắng</Badge> : row.finishedAt ? <Badge tone="green">Đã nộp</Badge> : <Badge tone="gold">Chưa nộp</Badge>}</Td>
                  <Td className="text-right tabular-nums text-ink-soft">{row.present ? row.answered : "–"}</Td>
                  <Td className="text-right tabular-nums text-ink-soft">{row.present ? row.correct : "–"}</Td>
                  <Td className="text-right font-medium tabular-nums">{fmtScore(row.score)}</Td>
                  <Td className="text-right tabular-nums text-muted">{fmtDur(row.durationSec)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-[30px] font-bold leading-none text-ink">Kết quả từng câu</h2>
            <div className="no-print ml-auto flex border-2 border-ink bg-white">
              {(
                [
                  [false, "Theo thứ tự", `/sessions/${s.id}/report`],
                  [true, "Câu khó trước", `/sessions/${s.id}/report?sort=hard`],
                ] as const
              ).map(([v, label, href]) => (
                <Link
                  key={label}
                  href={href}
                  scroll={false}
                  className={cx("px-3 py-0.5 font-display text-[18px] font-semibold transition-colors [&+&]:border-l-2 [&+&]:border-ink", hardFirst === v ? "bg-accent text-white" : "text-ink-soft hover:bg-accent-soft")}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="px-card flex flex-col divide-y-2 divide-ink/15">
            {questions.map((q) => (
              <div key={q.index} className="print-break-avoid px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="w-14 shrink-0 font-display text-[20px] font-bold leading-6 text-accent">Câu {q.index}</span>
                  <p className="flex-1 text-[15px] leading-relaxed text-ink">
                    {q.type !== "SINGLE" && <span className="mr-1.5 text-[12px] font-medium text-muted">[{TYPE_LABEL[q.type]}]</span>}
                    {q.content}
                  </p>
                  <span
                    className={cx(
                      "shrink-0 font-display text-[26px] font-bold leading-none tabular-nums",
                      q.rate == null ? "text-muted" : q.rate < 0.4 ? "text-danger" : q.rate < 0.7 ? "text-warn" : "text-ok",
                    )}
                  >
                    {pct(q.rate)}
                  </span>
                </div>
                {q.type === "SHORT" ? (
                  <div className="mt-3 pl-15">
                    <p className="mb-1.5 text-[13px] text-ok">Đáp án: {q.options.map((o) => o.content).join(" / ")}</p>
                    <ShortResponses sessionId={s.id} questionId={q.id} items={q.responses} />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-1.5 pl-15">
                    {q.options.map((o, i) => {
                      const share = q.answered ? o.picked / q.answered : 0;
                      return (
                        <div key={i} className="flex items-center gap-3 text-[13px]">
                          <span className={cx("w-3 shrink-0 font-display text-[17px] font-bold", q.type === "SINGLE" && o.isCorrect ? "text-ok" : "text-muted")}>
                          {q.type === "TRUE_FALSE" ? STATEMENT_LABELS[i] : LETTERS[i]}
                        </span>
                          <div className="min-w-0 flex-1">
                            <p className={cx("truncate", q.type === "SINGLE" && o.isCorrect ? "font-medium text-ok" : "text-ink-soft")}>
                            {q.type === "TRUE_FALSE" && <b className={o.isCorrect ? "text-ok" : "text-danger"}>{o.isCorrect ? "Đ" : "S"} · </b>}
                            {o.content}
                          </p>
                            <div className="mt-1 h-2 bg-paper outline-1 outline-ink/20">
                              <div className={cx("px-meter h-full", o.isCorrect || q.type === "TRUE_FALSE" ? "bg-mint" : "bg-ink/30")} style={{ width: `${share * 100}%` }} />
                            </div>
                          </div>
                          <span className="w-6 shrink-0 text-right tabular-nums text-muted">{o.picked}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
      <p className="print-only text-right text-xs text-muted">
        {brandLine} · In lúc {fmtTime(new Date())}
      </p>
    </div>
  );
}
