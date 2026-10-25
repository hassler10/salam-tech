"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea";
  help?: string;
  wide?: boolean;
};

const PUBLIC_FIELDS: Field[] = [
  { key: "library_name", label: "Nom complet de la bibliothèque", wide: true },
  {
    key: "library_short_name",
    label: "Nom court (en-têtes)",
    help: "Affiché dans la navigation, la connexion et l'application installée. Ex. : SALAM LIBRARY.",
  },
  {
    key: "library_subtitle",
    label: "Sous-titre / organisation",
    help: "Affiché sous le nom court. Ex. : Mosquée Salam du Plateau.",
  },
  { key: "library_city", label: "Ville / pays" },
  {
    key: "library_tagline",
    label: "Accroche de la page d'accueil",
    help: "Titre principal affiché en haut de la vitrine publique.",
    wide: true,
  },
  {
    key: "library_hero_intro",
    label: "Introduction de la vitrine",
    help: "Texte affiché sous l'accroche, avant le bouton de découverte.",
    type: "textarea",
    wide: true,
  },
  {
    key: "library_about",
    label: "Présentation de la bibliothèque",
    type: "textarea",
    help: "Texte affiché dans la section « La bibliothèque ».",
    wide: true,
  },
  { key: "library_address", label: "Adresse" },
  {
    key: "opening_hours",
    label: "Horaires d'ouverture",
    help: "Ex. : Lundi – Samedi · 09h00 – 18h00. Laisser vide affiche un renvoi vers l'accueil.",
  },
  { key: "library_phone", label: "Téléphone / WhatsApp" },
  { key: "library_email", label: "Adresse e-mail" },
  {
    key: "library_map_url",
    label: "Lien de localisation",
    help: "Laisser vide pour une recherche automatique sur Google Maps.",
    wide: true,
  },
];

const SYSTEM_FIELDS: Field[] = [
  { key: "alert_soon_days", label: "Seuil « bientôt expiré » (jours)", type: "number" },
  { key: "alert_imminent_days", label: "Seuil « expiration imminente » (jours)", type: "number" },
  {
    key: "duplicate_window_minutes",
    label: "Fenêtre anti-doublon (minutes)",
    type: "number",
    help: "Empêche l'enregistrement de deux visites identiques rapprochées.",
  },
  { key: "session_timeout_minutes", label: "Déconnexion automatique (minutes)", type: "number" },
  {
    key: "self_service_enabled",
    label: "Borne d'auto-enregistrement (1 = activée, 0 = désactivée)",
    type: "number",
    help: "Page publique /borne : chaque personne enregistre sa propre visite sans voir les autres fiches.",
    wide: true,
  },
];

const MAX_UPLOAD_BYTES = 12_000_000;
const MEDIA_ENCODED_LIMIT = { logo: 2_500_000, cover: 5_500_000 } as const;

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

async function prepareImage(file: File, maxDimension: number, maxEncodedLength: number): Promise<string> {
  const raw = await readFile(file);
  try {
    if (file.type === "image/webp" && raw.length <= maxEncodedLength && file.size <= 1_500_000) {
      const bitmap = await createImageBitmap(file);
      const fits = Math.max(bitmap.width, bitmap.height) <= maxDimension;
      bitmap.close();
      if (fits) return raw;
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return raw;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let quality = 0.9;
    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    while (dataUrl.length > maxEncodedLength - 64 && quality > 0.4) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL("image/webp", quality);
    }
    return dataUrl;
  } catch {
    return raw;
  }
}

function MediaEditor({
  kind,
  title,
  description,
  initialUrl,
}: {
  kind: "logo" | "cover";
  title: string;
  description: string;
  initialUrl: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("Format accepté : PNG, JPG ou WebP.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage("Fichier trop lourd (12 Mo maximum).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const dataUrl = await prepareImage(
        file,
        kind === "logo" ? 1200 : 2000,
        MEDIA_ENCODED_LIMIT[kind],
      );
      const res = await fetch("/api/settings/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, dataUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setMessage(json.error ?? "Enregistrement de l'image impossible.");
        return;
      }
      setUrl(json.url);
      setMessage("Image mise à jour.");
      router.refresh();
    } catch {
      setMessage("Image illisible. Essayez un autre fichier.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/settings/media?kind=${kind}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setMessage(json.error ?? "Réinitialisation impossible.");
        return;
      }
      setUrl(json.url);
      setMessage("Image par défaut rétablie.");
      router.refresh();
    } catch {
      setMessage("Réinitialisation impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-brand-900/[0.08] bg-[var(--surface-2)]/50 p-4 dark:border-white/[0.08]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
        <span className="rounded-full bg-brand-600/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-400/10 dark:text-brand-300">
          {kind === "logo" ? "Carré" : "Paysage"}
        </span>
      </div>

      <div
        className={`relative mt-4 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 ${
          kind === "logo"
            ? "grid h-40 place-items-center bg-gradient-to-br from-brand-950 to-brand-800"
            : "aspect-[16/9] bg-slate-100 dark:bg-white/5"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={kind === "logo" ? "Logo de la bibliothèque" : "Image de couverture"}
          className={
            kind === "logo"
              ? "h-24 w-24 rounded-2xl object-contain shadow-2xl ring-1 ring-white/20"
              : "h-full w-full object-cover"
          }
        />
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-brand-950/55 text-xs font-semibold text-white">
            Traitement…
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          id={`media-${kind}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={upload}
          disabled={busy}
        />
        <button
          type="button"
          className="btn-primary h-9 px-4 text-[12px]"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Choisir une image
        </button>
        <button
          type="button"
          className="btn-ghost h-9 px-3 text-[12px]"
          onClick={reset}
          disabled={busy}
        >
          Rétablir par défaut
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        PNG, JPG ou WebP · 12 Mo maximum.{" "}
        {kind === "logo"
          ? "Le logo est recadré en carré 512 × 512 px."
          : "La couverture est redimensionnée en 1920 × 1400 px maximum."}
      </p>
      {message && (
        <p className="mt-2 text-[12px] font-medium text-brand-700 dark:text-gold-300">{message}</p>
      )}
    </div>
  );
}

export default function SettingsClient({
  settings,
  logoUrl,
  coverUrl,
}: {
  settings: Record<string, string>;
  logoUrl: string;
  coverUrl: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(settings);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setOk(res.ok);
    setMsg(res.ok ? "Paramètres enregistrés." : (json.error ?? "Enregistrement impossible."));
    if (res.ok) router.refresh();
  };

  const renderField = (f: Field) => (
    <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
      <label className="label" htmlFor={`setting-${f.key}`}>
        {f.label}
      </label>
      {f.type === "textarea" ? (
        <textarea
          id={`setting-${f.key}`}
          className="input min-h-[120px] resize-y"
          value={values[f.key] ?? ""}
          onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
        />
      ) : (
        <input
          id={`setting-${f.key}`}
          className="input"
          type={f.type ?? "text"}
          value={values[f.key] ?? ""}
          onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
        />
      )}
      {f.help && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.help}</p>}
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="card">
        <div className="mb-5">
          <h2 className="section-title">Logo & image de couverture</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            Ces visuels sont utilisés sur la vitrine, la connexion, la borne, les impressions et
            l&apos;application installée.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <MediaEditor
            kind="logo"
            title="Logo officiel"
            description="Remplacé partout dans l'application, y compris l'icône PWA."
            initialUrl={logoUrl}
          />
          <MediaEditor
            kind="cover"
            title="Image de couverture"
            description="Photo d'illustration de la vitrine et de la page de connexion."
            initialUrl={coverUrl}
          />
        </div>
      </section>

      <section className="card">
        <div className="mb-5">
          <h2 className="section-title">Identité & page d&apos;accueil publique</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            Ces informations sont visibles par tous les visiteurs de la vitrine, avant toute
            connexion.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PUBLIC_FIELDS.map(renderField)}
        </div>
      </section>

      <section className="card">
        <div className="mb-5">
          <h2 className="section-title">Exploitation & sécurité</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            Seuils d&apos;alerte et règles de fonctionnement de la plateforme.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SYSTEM_FIELDS.map(renderField)}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary">Enregistrer les paramètres</button>
        {msg && (
          <span
            className={`text-sm font-medium ${
              ok
                ? "text-[#166534] dark:text-[#c5a253]"
                : "text-rose-600 dark:text-rose-300"
            }`}
          >
            {msg}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Protection des données : seules les informations strictement nécessaires sont collectées
        (identité, contact facultatif, historique de fréquentation). Aucune donnée financière n&apos;est traitée.
      </p>
    </form>
  );
}
