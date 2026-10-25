import { getBranding, type Branding } from "./branding";

export type PublicContent = Branding;

export async function getPublicContent(): Promise<PublicContent> {
  return getBranding();
}
