"use client";

import { Icon } from "./icons";

export default function PrintButton({ label = "Imprimer / PDF" }: { label?: string }) {
  return (
    <button className="btn-gold no-print" onClick={() => window.print()}>
      <Icon name="printer" className="h-4 w-4" />
      {label}
    </button>
  );
}
