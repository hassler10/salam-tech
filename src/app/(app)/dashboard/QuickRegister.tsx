"use client";

import { useState } from "react";
import Link from "next/link";
import ReceptionClient from "../accueil/ReceptionClient";

type RecentVisit = {
  id: number;
  displayName: string;
  personType: string;
  reason: string | null;
  occurredAt: string;
  agentName: string | null;
  syncStatus: string;
};

export default function QuickRegister({
  reasons,
  recent,
}: {
  reasons: string[];
  recent: RecentVisit[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="no-print">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#166534] to-[#14532d] text-lg text-white">
            🛎️
          </span>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#14532d] dark:text-[#c5a253]">
              Poste d&apos;enregistrement
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enregistrez une visite sans quitter le tableau de bord.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/accueil" className="btn-ghost px-3 py-1.5 text-xs">
            Mode plein écran
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="btn-ghost px-3 py-1.5 text-xs">
            {open ? "▲ Replier" : "▼ Déplier"}
          </button>
        </div>
      </div>

      {open && <ReceptionClient reasons={reasons} recent={recent} embedded />}
    </section>
  );
}
