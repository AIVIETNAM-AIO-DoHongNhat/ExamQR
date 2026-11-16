import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { missingEnv } from "@/lib/env";
import { getTeacher } from "@/server/auth";
import { loadReport } from "@/server/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (missingEnv().length) return NextResponse.json({ error: "Hệ thống chưa được cấu hình" }, { status: 503 });
  const t = await getTeacher();
  if (!t) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const r = await loadReport(id, t.id);
  if (!r) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "ExamQR";

  // Sheet 1: cột đầu là SBD (sắp xếp tăng dần) để giảng viên ghép với danh sách họ tên bằng VLOOKUP.
  const ws = wb.addWorksheet("Bảng điểm");
  ws.columns = [
    { header: "SBD", key: "sbd", width: 12 },
    { header: "Trạng thái", key: "status", width: 12 },
    { header: "Số câu đã làm", key: "answered", width: 14 },
    { header: "Số câu đúng", key: "correct", width: 12 },
    { header: "Điểm (thang 10)", key: "score", width: 15 },
    { header: "Thời gian làm (phút)", key: "minutes", width: 18 },
  ];
  for (const row of r.rows) {
    ws.addRow({
      sbd: row.sbd,
      status: !row.present ? "Vắng" : row.finishedAt ? "Đã nộp" : "Chưa nộp",
      answered: row.present ? row.answered : null,
      correct: row.present ? row.correct : null,
      score: row.score,
      minutes: row.durationSec == null ? null : Math.round((row.durationSec / 60) * 10) / 10,
    });
  }
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8C1C2B" } };
  ws.getColumn("sbd").numFmt = "@";
  ws.getColumn("score").numFmt = "0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  // Sheet 2: thống kê từng câu
  const qs = wb.addWorksheet("Thống kê câu hỏi");
  qs.columns = [
    { header: "Câu", key: "i", width: 6 },
    { header: "Nội dung", key: "content", width: 70 },
    { header: "Số người trả lời", key: "answered", width: 16 },
    { header: "Số người đúng", key: "correct", width: 14 },
    { header: "Tỉ lệ đúng", key: "rate", width: 12 },
  ];
  for (const q of r.questions) {
    qs.addRow({ i: q.index, content: q.content, answered: q.answered, correct: q.correct, rate: q.rate });
  }
  qs.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  qs.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B1A18" } };
  qs.getColumn("rate").numFmt = "0%";
  qs.getColumn("content").alignment = { wrapText: true, vertical: "top" };

  const buf = await wb.xlsx.writeBuffer();
  const date = (r.session.startedAt ?? r.session.createdAt).toISOString().slice(0, 10);
  const name = `ExamQR_${r.session.code}_${date}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
