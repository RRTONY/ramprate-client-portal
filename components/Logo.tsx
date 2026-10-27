import Image from "next/image";
import logo from "@/public/brand/ramprate-logo.png";

/**
 * Imported statically so it is bundled at build time. The old version looked for the file on disk
 * at runtime, which fails on serverless hosts like Netlify and silently fell back to a placeholder.
 */
export function Logo({
  size = 36,
  onDark = false,
}: {
  size?: number;
  onDark?: boolean;
}) {
  return (
    <Image
      src={logo}
      alt="RampRate"
      priority
      style={{ height: size, width: "auto" }}
      className={onDark ? "brightness-0 invert" : ""}
    />
  );
}
