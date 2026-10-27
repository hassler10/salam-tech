import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    { error: "L'auto-enregistrement public est désactivé. Adressez-vous à l'accueil." },
    { status: 410 },
  );
}

export function GET() {
  return disabled();
}

export function POST() {
  return disabled();
}
