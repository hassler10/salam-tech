import { getBranding } from "@/lib/branding";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function OfflinePage() {
  const branding = await getBranding();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 px-4 py-10 text-white">
      <div className="absolute inset-0 pattern-grid opacity-20" />
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-gold-500/10 blur-3xl" />

      <div className="relative w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branding.logoUrl}
          alt={`Logo de ${branding.name}`}
          width={72}
          height={72}
          className="mx-auto rounded-2xl object-contain shadow-2xl ring-1 ring-white/20"
        />
        <p className="mt-3 font-display text-[13px] font-semibold tracking-[0.16em] text-white">
          {branding.shortName}
        </p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-gold-300">{branding.org}</p>
        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.06] p-7 backdrop-blur-xl sm:p-8">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-400/15 text-gold-300">
            <Icon name="wifi" className="h-6 w-6" />
          </span>
          <p className="eyebrow mt-4 justify-center">Mode hors connexion</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Vous êtes hors connexion</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            La page demandée n&apos;est pas disponible hors connexion. La page « Accueil et
            fréquentation » reste accessible et les visites enregistrées seront synchronisées
            au retour d&apos;Internet.
          </p>
          <a className="btn-gold mt-6 w-full" href="/accueil">
            Aller à l&apos;accueil
            <Icon name="arrowRight" className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-5 text-[10.5px] text-white/35">
          {branding.name} · {branding.city}
        </p>
      </div>
    </div>
  );
}
