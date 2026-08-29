import QRCode from "qrcode";
import { APP_PUBLIC_URL } from "@/lib/constants";

export function credentialUrl(slug: string, baseUrl: string = APP_PUBLIC_URL) {
  return `${baseUrl.replace(/\/$/, "")}/credencial/${slug}`;
}

export async function credentialQrDataUrl(slug: string, baseUrl: string = APP_PUBLIC_URL) {
  return QRCode.toDataURL(credentialUrl(slug, baseUrl), {
    margin: 1,
    scale: 7,
    color: {
      dark: "#0f766e",
      light: "#ffffff",
    },
  });
}
