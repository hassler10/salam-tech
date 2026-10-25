export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-5xl">📴</p>
      <h1 className="text-xl font-bold text-[#14532d]">Hors connexion</h1>
      <p className="max-w-md text-sm text-slate-600">
        La page demandée n&apos;est pas disponible hors connexion. La page « Accueil et fréquentation »
        reste accessible et les visites enregistrées seront synchronisées au retour d&apos;Internet.
      </p>
      <a className="btn-primary" href="/accueil">Aller à l&apos;accueil</a>
    </div>
  );
}
