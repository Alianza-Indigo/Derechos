import QRCode from "qrcode";
import { APP_PUBLIC_URL } from "@/lib/constants";

export function credentialUrl(slug: string) {
  return `${APP_PUBLIC_URL}/credencial/${slug}`;
}

export async function credentialQrDataUrl(slug: string) {
  return QRCode.toDataURL(credentialUrl(slug), {
    margin: 1,
    scale: 7,
    color: {
      dark: "#0f766e",
      light: "#ffffff",
    },
  });
}
