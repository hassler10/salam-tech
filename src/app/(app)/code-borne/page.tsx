import { PageHeader } from "@/components/ui";
import GateCodeGenerator from "./GateCodeGenerator";

export default function GateCodePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Poste de réception"
        title="Code temporaire de la borne"
        subtitle="Ouvrez l’enregistrement autonome pour un visiteur ou un membre."
      />
      <GateCodeGenerator />
    </div>
  );
}
