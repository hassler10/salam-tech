import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionTypes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { getPublicContent } from "@/lib/public-content";
import { Icon, type IconName } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bibliothèque de la Mosquée Salam du Plateau",
  description:
    "Découvrez la Bibliothèque de la Mosquée Salam du Plateau à Abidjan : services, abonnements, horaires, accès et borne libre-service.",
  openGraph: {
    title: "Bibliothèque de la Mosquée Salam du Plateau",
    description:
      "Un espace de lecture, de recherche et d'apprentissage au cœur du Plateau, à Abidjan.",
    images: [
      {
        url: "/bibliotheque-salam.jpg",
        width: 800,
        height: 600,
        alt: "Salle de lecture de la Bibliothèque de la Mosquée Salam du Plateau",
      },
    ],
    type: "website",
    locale: "fr_CI",
  },
};

const SERVICES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "book",
    title: "Consultation sur place",
    text: "Un espace de lecture calme pour consulter les ouvrages et travailler sereinement.",
  },
  {
    icon: "ticket",
    title: "Abonnements",
    text: "Des formules adaptées à votre rythme pour profiter pleinement de la bibliothèque.",
  },
  {
    icon: "search",
    title: "Recherche documentaire",
    text: "Un accompagnement pour identifier les ouvrages et ressources adaptés à vos besoins.",
  },
  {
    icon: "users",
    title: "Accueil des visiteurs",
    text: "Un enregistrement simple, à l'accueil ou sur la borne libre-service.",
  },
];

const VALUES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "book",
    title: "Lecture & recherche",
    text: "Des collections et un cadre propice à la lecture, à l'étude et à la recherche.",
  },
  {
    icon: "users",
    title: "Accompagnement",
    text: "Une équipe disponible pour vous orienter et répondre à vos questions.",
  },
  {
    icon: "wifi",
    title: "Outils numériques",
    text: "Des outils numériques disponibles sur place pour la consultation et l'apprentissage.",
  },
  {
    icon: "sparkles",
    title: "Accueil de tous les publics",
    text: "Abonnés, visiteurs et groupes sont reçus avec la même attention.",
  },
];

export default async function Home() {
  await ensureSeed();
  const [content, user] = await Promise.all([getPublicContent(), getCurrentUser()]);

  let types: { id: number; name: string; durationMonths: number; description: string | null }[] = [];
  try {
    types = await db
      .select({
        id: subscriptionTypes.id,
        name: subscriptionTypes.name,
        durationMonths: subscriptionTypes.durationMonths,
        description: subscriptionTypes.description,
      })
      .from(subscriptionTypes)
      .where(eq(subscriptionTypes.active, true))
      .orderBy(asc(subscriptionTypes.durationMonths));
  } catch {
    // La vitrine doit rester consultable si la base est momentanément indisponible.
  }

  const formulas =
    types.length > 0
      ? types
      : [1, 3, 6, 12].map((months) => ({
          id: months,
          name: `Abonnement ${months} mois`,
          durationMonths: months,
          description: null,
        }));

  const shortest = Math.min(...formulas.map((f) => f.durationMonths));
  const longest = Math.max(...formulas.map((f) => f.durationMonths));
  const spaceHref = user ? (user.role === "agent" ? "/accueil" : "/dashboard") : "/login";
  const spaceLabel = user ? "Mon espace" : "Espace de gestion";
  const mapHref =
    content.mapUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${content.name} ${content.address}`,
    )}`;
  const phoneHref = content.phone ? `tel:${content.phone.replace(/[^\d+]/g, "")}` : null;
  const emailHref = content.email ? `mailto:${content.email}` : null;
  const hasDirectContact = Boolean(phoneHref || emailHref);
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-brand-950/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo de la bibliothèque"
              width={42}
              height={42}
              className="rounded-xl shadow-lg ring-1 ring-white/15"
            />
            <span className="leading-tight">
              <span className="block whitespace-nowrap font-display text-[12.5px] font-semibold tracking-[0.16em]">
                SALAM LIBRARY
              </span>
              <span className="mt-0.5 hidden whitespace-nowrap text-[9px] uppercase tracking-[0.2em] text-gold-300/90 sm:block">
                Mosquée Salam du Plateau
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-7 text-[12px] font-medium text-white/60 lg:flex"
          >
            <a href="#bibliotheque" className="transition hover:text-white">La bibliothèque</a>
            <a href="#services" className="transition hover:text-white">Services</a>
            <a href="#formules" className="transition hover:text-white">Abonnements</a>
            <a href="#acces" className="transition hover:text-white">Horaires & accès</a>
          </nav>

          <div className="flex items-center gap-2">
            {content.selfServiceEnabled && (
              <Link
                href="/borne"
                className="hidden h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 text-[12px] font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Icon name="ticket" className="h-3.5 w-3.5 text-gold-300" />
                Borne
              </Link>
            )}
            <Link
              href={spaceHref}
              className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-4 text-[12px] font-semibold text-brand-950 shadow-[0_10px_24px_-14px_rgb(197_162_83/0.9)] ring-1 ring-inset ring-white/30 transition hover:from-gold-200 hover:to-gold-400"
            >
              <span className="sm:hidden">{user ? spaceLabel : "Espace"}</span>
              <span className="hidden sm:inline">{spaceLabel}</span>
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="absolute inset-0 pattern-grid opacity-20" />
        <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-brand-400/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <p className="eyebrow text-gold-300">
              <span className="h-1 w-6 rounded-full bg-gradient-to-r from-gold-300 to-gold-500" />
              {content.name}
            </p>
            <h1 className="mt-5 font-display text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[52px] xl:text-[60px]">
              <span className="text-gradient-gold">{content.tagline}</span>
            </h1>
            <p className="mt-6 max-w-xl text-[14px] leading-7 text-white/65 sm:text-[15px]">
              Un espace de lecture, de recherche et d&apos;apprentissage ouvert à la communauté.
              Retrouvez-nous à {content.city}.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#bibliotheque" className="btn-gold h-11 px-5 text-[13px]">
                Découvrir la bibliothèque
                <Icon name="arrowRight" className="h-4 w-4" />
              </a>
              <Link
                href={content.selfServiceEnabled ? "/borne" : "#acces"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 text-[13px] font-semibold text-white/85 backdrop-blur transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              >
                <Icon name="ticket" className="h-4 w-4 text-gold-300" />
                {content.selfServiceEnabled ? "Enregistrer ma visite" : "Voir les accès"}
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap gap-2.5">
              <span className="chip">
                <Icon name="mapPin" className="h-3.5 w-3.5 text-gold-300" />
                Plateau · Abidjan
              </span>
              <span className="chip">
                <Icon name="users" className="h-3.5 w-3.5 text-gold-300" />
                Abonnés & visiteurs
              </span>
              <span className="chip">
                <Icon name="calendar" className="h-3.5 w-3.5 text-gold-300" />
                Formules de {shortest} à {longest} mois
              </span>
            </div>
          </div>

          <div className="relative animate-fade-up lg:pl-4">
            <div className="pointer-events-none absolute -right-4 -top-6 h-40 w-40 rounded-full bg-gold-400/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl ring-1 ring-white/10">
              <div className="relative aspect-[4/3]">
                <Image
                  src="/bibliotheque-salam.jpg"
                  alt="Salle de lecture de la Bibliothèque de la Mosquée Salam du Plateau"
                  fill
                  priority
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-brand-950/10 to-transparent" />
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-brand-950/70 p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9.5px] uppercase tracking-[0.2em] text-gold-300">
                      Salle de lecture
                    </p>
                    <p className="mt-1 font-display text-[15px] font-semibold">
                      Un cadre paisible, ouvert à tous
                    </p>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-300">
                    <Icon name="book" className="h-[18px] w-[18px]" />
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute -left-3 top-5 hidden items-center gap-2 rounded-2xl border border-white/15 bg-brand-950/80 px-4 py-3 text-[11px] font-semibold text-white/80 shadow-xl backdrop-blur-xl sm:flex">
              <Icon name="mapPin" className="h-3.5 w-3.5 text-gold-300" />
              {content.city}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-brand-900/[0.06] bg-white/60 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-6 px-5 py-8 sm:grid-cols-4">
          {[
            { icon: "mapPin" as IconName, label: "Lieu", value: "Plateau, Abidjan" },
            { icon: "calendar" as IconName, label: "Abonnements", value: `${shortest} à ${longest} mois` },
            { icon: "users" as IconName, label: "Public", value: "Abonnés & visiteurs" },
            {
              icon: "ticket" as IconName,
              label: "Accueil",
              value: content.selfServiceEnabled ? "Borne libre-service" : "Sur place",
            },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-900/[0.06] dark:bg-white/[0.05] dark:text-gold-300 dark:ring-white/[0.08]">
                <Icon name={f.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {f.label}
                </span>
                <span className="mt-0.5 block text-[12px] font-semibold leading-5 text-slate-800 dark:text-slate-100">
                  {f.value}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section id="bibliotheque" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div>
            <p className="eyebrow">La bibliothèque</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[38px]">
              Un lieu de savoir et de rencontre
            </h2>
            <p className="mt-5 text-[14.5px] leading-8 text-slate-600 dark:text-slate-300">
              {content.about}
            </p>
            <a
              href="#services"
              className="mt-7 inline-flex items-center gap-2 text-[13px] font-semibold text-brand-700 transition hover:gap-3 hover:text-brand-800 dark:text-gold-300 dark:hover:text-gold-200"
            >
              Découvrir nos services
              <Icon name="arrowRight" className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="rounded-3xl border border-brand-900/[0.07] bg-[var(--surface)]/85 p-5 shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-gold-500/30 hover:shadow-lift dark:border-white/[0.08] dark:bg-[var(--surface)]/70 dark:shadow-none"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-500/10 text-gold-700 ring-1 ring-gold-500/15 dark:text-gold-300">
                  <Icon name={v.icon} className="h-[18px] w-[18px]" />
                </span>
                <h3 className="mt-4 text-[13.5px] font-semibold text-slate-900 dark:text-white">
                  {v.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-6 text-slate-500 dark:text-slate-400">
                  {v.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="services"
        className="scroll-mt-24 border-y border-brand-900/[0.06] bg-brand-50/60 py-16 dark:border-white/[0.06] dark:bg-white/[0.02] lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-2xl">
            <p className="eyebrow">Nos services</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[38px]">
              Tout ce qui rend la bibliothèque utile
            </h2>
            <p className="mt-4 text-[14px] leading-7 text-slate-500 dark:text-slate-400">
              Un accompagnement humain et des espaces pensés pour lire, chercher et apprendre dans
              de bonnes conditions.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <div
                key={s.title}
                className="group relative rounded-3xl border border-brand-900/[0.07] bg-white/85 p-6 shadow-soft backdrop-blur-xl transition hover:-translate-y-1 hover:border-brand-500/25 hover:shadow-lift dark:border-white/[0.08] dark:bg-[var(--surface)]/70 dark:shadow-none"
              >
                <span className="absolute right-5 top-5 font-display text-[11px] font-semibold tracking-[0.14em] text-slate-300 dark:text-white/20">
                  0{i + 1}
                </span>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-900/15">
                  <Icon name={s.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-[14px] font-semibold text-slate-900 dark:text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-6 text-slate-500 dark:text-slate-400">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="formules" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 lg:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Abonnements</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[38px]">
              Une formule pour chaque rythme
            </h2>
            <p className="mt-4 text-[14px] leading-7 text-slate-500 dark:text-slate-400">
              Choisissez la durée qui vous convient. Les conditions et tarifs sont communiqués à
              l&apos;accueil de la bibliothèque.
            </p>
          </div>
          {hasDirectContact && (
            <a href="#acces" className="btn-ghost h-10 shrink-0 text-[12.5px]">
              Demander une information
              <Icon name="arrowRight" className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {formulas.map((f) => (
            <div
              key={f.id}
              className="flex flex-col rounded-3xl border border-brand-900/[0.07] bg-[var(--surface)]/85 p-6 shadow-soft backdrop-blur-xl transition hover:border-gold-500/35 hover:shadow-glow dark:border-white/[0.08] dark:bg-[var(--surface)]/70 dark:shadow-none"
            >
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[40px] font-semibold leading-none tracking-tight text-brand-800 dark:text-gold-300">
                  {f.durationMonths}
                </span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  mois
                </span>
              </div>
              <p className="mt-4 text-[13px] font-semibold text-slate-900 dark:text-white">
                {f.name}
              </p>
              <p className="mt-1.5 flex-1 text-[11.5px] leading-6 text-slate-500 dark:text-slate-400">
                {f.description || "Formule d'abonnement de la bibliothèque."}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 border-t border-brand-900/[0.06] pt-4 text-[11px] font-semibold text-brand-700 dark:border-white/[0.08] dark:text-gold-300">
                <Icon name="check" className="h-3.5 w-3.5" />
                Accès aux services de la bibliothèque
              </span>
            </div>
          ))}
        </div>
      </section>

      <section
        id="acces"
        className="scroll-mt-24 border-y border-brand-900/[0.06] bg-white/60 py-16 dark:border-white/[0.06] dark:bg-white/[0.02] lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-2xl">
            <p className="eyebrow">Horaires & accès</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[38px]">
              Nous rendre visite
            </h2>
            <p className="mt-4 text-[14px] leading-7 text-slate-500 dark:text-slate-400">
              La bibliothèque se situe au Plateau, à Abidjan. Retrouvez ci-dessous les informations
              pratiques pour préparer votre visite.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-brand-900/[0.07] bg-[var(--surface)]/85 p-6 shadow-soft backdrop-blur-xl dark:border-white/[0.08] dark:bg-[var(--surface)]/70 dark:shadow-none sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600/10 text-brand-700 dark:text-gold-300">
                  <Icon name="mapPin" className="h-5 w-5" />
                </span>
                <h3 className="section-title">Adresse & horaires</h3>
              </div>

              <div className="mt-6 space-y-5">
                <div className="flex gap-3">
                  <Icon name="mapPin" className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-300" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      {content.address}
                    </p>
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 transition hover:text-brand-800 dark:text-gold-300 dark:hover:text-gold-200"
                    >
                      Ouvrir l&apos;itinéraire
                      <Icon name="arrowRight" className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-300" />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      Horaires d&apos;ouverture
                    </p>
                    <p className="mt-0.5 text-[12px] leading-6 text-slate-500 dark:text-slate-400">
                      {content.hours || "Horaires communiqués à l'accueil de la bibliothèque."}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Icon name="users" className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-300" />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      Public accueilli
                    </p>
                    <p className="mt-0.5 text-[12px] leading-6 text-slate-500 dark:text-slate-400">
                      Abonnés, visiteurs et groupes, dans le respect des règles de la bibliothèque.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-brand-900/[0.07] bg-[var(--surface)]/85 p-6 shadow-soft backdrop-blur-xl dark:border-white/[0.08] dark:bg-[var(--surface)]/70 dark:shadow-none sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500/10 text-gold-700 dark:text-gold-300">
                  <Icon name="phone" className="h-5 w-5" />
                </span>
                <h3 className="section-title">Contact & accueil</h3>
              </div>

              <div className="mt-6 space-y-5">
                {phoneHref && (
                  <a href={phoneHref} className="group flex gap-3">
                    <Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-300" />
                    <span>
                      <span className="block text-[12px] text-slate-500 dark:text-slate-400">
                        Téléphone
                      </span>
                      <span className="mt-0.5 block text-[13px] font-semibold text-slate-800 transition group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-gold-300">
                        {content.phone}
                      </span>
                    </span>
                  </a>
                )}

                {emailHref && (
                  <a href={emailHref} className="group flex gap-3">
                    <Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-300" />
                    <span>
                      <span className="block text-[12px] text-slate-500 dark:text-slate-400">
                        E-mail
                      </span>
                      <span className="mt-0.5 block break-all text-[13px] font-semibold text-slate-800 transition group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-gold-300">
                        {content.email}
                      </span>
                    </span>
                  </a>
                )}

                <div className="flex gap-3">
                  <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-300" />
                  <div>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Accueil sur place</p>
                    <p className="mt-0.5 text-[12px] leading-6 text-slate-500 dark:text-slate-400">
                      L&apos;équipe vous reçoit aux heures d&apos;ouverture pour toute question sur
                      les abonnements et les services.
                    </p>
                  </div>
                </div>

                {content.selfServiceEnabled && (
                  <div className="flex gap-3">
                    <Icon name="ticket" className="mt-0.5 h-4 w-4 shrink-0 text-gold-600 dark:text-gold-300" />
                    <div>
                      <p className="text-[12px] text-slate-500 dark:text-slate-400">
                        Borne libre-service
                      </p>
                      <p className="mt-0.5 text-[12px] leading-6 text-slate-500 dark:text-slate-400">
                        Enregistrez votre visite en quelques secondes, sans passer par l&apos;accueil.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-wrap gap-2.5">
                {phoneHref && (
                  <a href={phoneHref} className="btn-primary h-10 text-[12.5px]">
                    <Icon name="phone" className="h-4 w-4" />
                    Appeler
                  </a>
                )}
                {emailHref && (
                  <a href={emailHref} className="btn-ghost h-10 text-[12.5px]">
                    <Icon name="mail" className="h-4 w-4" />
                    Écrire
                  </a>
                )}
                {!hasDirectContact && (
                  <a href={mapHref} target="_blank" rel="noopener noreferrer" className="btn-primary h-10 text-[12.5px]">
                    <Icon name="mapPin" className="h-4 w-4" />
                    Ouvrir l&apos;itinéraire
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-950 px-6 py-12 text-white shadow-lift sm:px-10 lg:px-14 lg:py-16">
          <div className="absolute inset-0 pattern-grid opacity-20" />
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-gold-500/20 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="eyebrow text-gold-300">Votre visite</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-[36px]">
                Votre prochaine visite commence ici.
              </h2>
              <p className="mt-4 text-[13.5px] leading-7 text-white/60">
                Abonnés ou visiteurs, enregistrez votre passage en quelques secondes et profitez
                pleinement de la bibliothèque.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {content.selfServiceEnabled && (
                <Link href="/borne" className="btn-gold h-11 px-5 text-[13px]">
                  <Icon name="ticket" className="h-4 w-4" />
                  Enregistrer ma visite
                </Link>
              )}
              <Link
                href={spaceHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] px-5 text-[13px] font-semibold text-white/85 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <Icon name="shield" className="h-4 w-4 text-gold-300" />
                {spaceLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-brand-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Logo de la bibliothèque"
                  width={44}
                  height={44}
                  className="rounded-xl ring-1 ring-white/15"
                />
                <div>
                  <p className="font-display text-[13px] font-semibold tracking-[0.12em]">
                    SALAM LIBRARY
                  </p>
                  <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.18em] text-gold-300/90">
                    Mosquée Salam du Plateau
                  </p>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-[12px] leading-6 text-white/45">
                {content.name} — un espace de lecture et d&apos;apprentissage au service de la
                communauté, à {content.city}.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Navigation
              </p>
              <ul className="mt-4 space-y-2.5 text-[12px] text-white/60">
                <li><a href="#bibliotheque" className="transition hover:text-white">La bibliothèque</a></li>
                <li><a href="#services" className="transition hover:text-white">Services</a></li>
                <li><a href="#formules" className="transition hover:text-white">Abonnements</a></li>
                <li><a href="#acces" className="transition hover:text-white">Horaires & accès</a></li>
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                Accès rapide
              </p>
              <ul className="mt-4 space-y-2.5 text-[12px] text-white/60">
                {content.selfServiceEnabled && (
                  <li><Link href="/borne" className="transition hover:text-white">Borne libre-service</Link></li>
                )}
                <li><Link href={spaceHref} className="transition hover:text-white">{spaceLabel}</Link></li>
                <li>
                  <a href={mapHref} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
                    Itinéraire
                  </a>
                </li>
                {phoneHref && (
                  <li><a href={phoneHref} className="transition hover:text-white">{content.phone}</a></li>
                )}
                {emailHref && (
                  <li><a href={emailHref} className="break-all transition hover:text-white">{content.email}</a></li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-[10.5px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <p>© {year} {content.name}. Tous droits réservés.</p>
            <p>Plateau · Abidjan · Salam Library Pro</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
