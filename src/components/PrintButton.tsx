"use client";
import { Button } from "./ui";
import { Printer } from "./icons";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      In báo cáo
    </Button>
  );
}
