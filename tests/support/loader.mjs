// Lets Node run the app's server code in tests: resolves the "@/..." path alias the way
// tsconfig does, and swaps Supabase and Next.js runtime modules for in-memory fakes.
import { statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "../..");
const support = path.join(root, "tests/support");

const FAKES = {
  "@/lib/supabase/server": "fake-supabase.ts",
  "@supabase/ssr": "fake-supabase.ts",
  "next/navigation": "fake-next.ts",
  "next/cache": "fake-next.ts",
  "next/headers": "fake-next.ts",
  "@/lib/request-cache": "fake-request-cache.ts",
};

const isFile = (f) => {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
};

export async function resolve(specifier, context, nextResolve) {
  if (FAKES[specifier]) {
    return {
      url: pathToFileURL(path.join(support, FAKES[specifier])).href,
      format: "module-typescript",
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const f of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (isFile(f)) {
        return {
          url: pathToFileURL(f).href,
          format: "module-typescript",
          shortCircuit: true,
        };
      }
    }
  }
  // Next 14 has no "exports" map, so ESM needs the real file name.
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  const resolved = await nextResolve(specifier, context);
  // App files have no "type" in package.json; tell Node they are ES modules up front.
  if (
    resolved.url.startsWith(pathToFileURL(root).href) &&
    !resolved.url.includes("/node_modules/") &&
    resolved.url.endsWith(".ts")
  ) {
    return { ...resolved, format: "module-typescript" };
  }
  return resolved;
}
