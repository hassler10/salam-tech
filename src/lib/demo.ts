/**
 * Mode démonstration : activé uniquement sur la Preview dédiée (base fictive).
 * Il assouplit les contrôles de la borne et affiche un bandeau, sans effet en production.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
