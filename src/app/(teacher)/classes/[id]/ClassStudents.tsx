"use client";
import { useState, useTransition } from "react";
import { addStudents, removeStudent } from "@/server/teacher-actions";
import { Button, Card, CardHeader, Label, Textarea } from "@/components/ui";
import { Plus, X } from "@/components/icons";

export function ClassStudents({ classId, students }: { classId: string; students: { id: string; sbd: string; used: boolean }[] }) {
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader
          title={
            <>
              Số báo danh <span className="text-muted">({students.length})</span>
            </>
          }
          description="Số đã có bài làm (nền xanh) không xóa được."
        />
        {students.length === 0 ? (
          <p className="text-[15px] text-muted">Chưa có số báo danh.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
            {students.map((s) =>
              s.used ? (
                <div key={s.id} className="flex h-10 items-center justify-center px-tile bg-mint font-display text-[22px] font-bold text-ink">
                  {s.sbd}
                </div>
              ) : (
                <div key={s.id} className="group flex h-10 items-center justify-between px-tile bg-white pl-3 font-display text-[22px] font-bold text-ink">
                  {s.sbd}
                  <button
                    type="button"
                    aria-label={`Xóa số báo danh ${s.sbd}`}
                    title="Xóa"
                    disabled={pending}
                    className="grid h-10 w-8 place-items-center text-ink/25 transition-colors hover:text-danger group-hover:text-muted"
                    onClick={() =>
                      start(async () => {
                        const r = await removeStudent(classId, s.id);
                        if (!r.ok) setMsg(r.error);
                      })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Thêm số báo danh" />
        <div className="flex flex-col gap-4">
          <label>
            <Label>Khoảng hoặc danh sách</Label>
            <Textarea rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder={"001-040\n101, 102, 105"} />
          </label>
          <Button
            disabled={pending || !input.trim()}
            onClick={() =>
              start(async () => {
                const r = await addStudents(classId, input);
                setMsg([`Đã thêm ${r.added}`, r.skipped ? `bỏ qua ${r.skipped} số đã có` : null, ...r.errors].filter(Boolean).join(" · "));
                if (r.errors.length === 0) setInput("");
              })
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            Thêm
          </Button>
          {msg && (
            <p role="status" className="text-sm text-ink-soft">
              {msg}
            </p>
          )}
          <p className="text-[13px] leading-relaxed text-muted">Hệ thống chỉ lưu số báo danh, không lưu họ tên học viên.</p>
        </div>
      </Card>
    </div>
  );
}
