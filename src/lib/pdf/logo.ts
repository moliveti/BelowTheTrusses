import { readFileSync } from "fs";
import path from "path";

// Read once per server instance -- shared by every PDF generator
// (quotes, contracts, and any future ones) so the logo only needs to
// change in one place (public/logo.png) to update everywhere.
let cachedLogo: Buffer | null = null;

export function getLogoBuffer(): Buffer {
  if (!cachedLogo) {
    cachedLogo = readFileSync(path.join(process.cwd(), "public", "logo.png"));
  }
  return cachedLogo;
}
