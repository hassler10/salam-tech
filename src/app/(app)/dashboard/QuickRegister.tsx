"use client";

import { useState } from "react";
import Link from "next/link";
import ReceptionClient from "../accueil/ReceptionClient";
import { Icon } from "@/components/icons";

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-gold-200 shadow-lg ring-1 ring-white/20">
            <Icon name="bell" className="h-[19px] w-[19px]" />
          </span>
          <div>
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
              Poste d&apos;enregistrement
            </h2>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
              Enregistrez une visite sans quitter le tableau de bord.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/accueil" className="btn-ghost px-3 py-1.5 text-[11px]">
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
            Plein écran
          </Link>
          <button onClick={() => setOpen((v) => !v)} className="btn-ghost px-3 py-1.5 text-[11px]">
            {open ? "Replier" : "Déplier"}
          </button>
        </div>
      </div>

      {open && <ReceptionClient reasons={reasons} recent={recent} embedded />}
    </section>
  );
}
