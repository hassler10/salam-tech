"use client";

export default function PrintButton({ label = "🖨️ Imprimer / PDF" }: { label?: string }) {
  return (
    <button className="btn-gold no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
