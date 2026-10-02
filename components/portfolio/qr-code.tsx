import QRCode from "qrcode";

/**
 * QR code for a public URL, rendered as React SVG from the module matrix (no
 * injected markup). Only ever given the public portfolio URL.
 */
export function QrCode({ url, size = 168, label }: { url: string; size?: number; label: string }) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 2;
  const cells: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(x, y)) cells.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }
  }
  const total = n + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className="rounded-lg border bg-white"
      data-testid="portfolio-qr"
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={cells.join("")} fill="#0e0f17" />
    </svg>
  );
}
