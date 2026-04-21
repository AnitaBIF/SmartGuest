import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/** Cuadrado para que el wordmark no quede como “mancha negra” al 16×16. */
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default async function Icon() {
  const file = path.join(process.cwd(), "public", "smartguest-favicon.png");
  const buf = await readFile(file);
  const src = `data:image/png;base64,${buf.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img alt="" src={src} width={168} height={36} />
      </div>
    ),
    { ...size }
  );
}
