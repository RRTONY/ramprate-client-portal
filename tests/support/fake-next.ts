// Stand-ins for next/navigation, next/cache and next/headers.
// redirect() and notFound() throw, like the real ones, so tests can assert where an action sends the user.

export class RedirectSignal extends Error {
  url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT ${url}`);
    this.url = url;
  }
}

export class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

export const nav = { revalidated: [] as string[] };

export function resetNav() {
  nav.revalidated = [];
}

export function redirect(url: string): never {
  throw new RedirectSignal(url);
}

export function notFound(): never {
  throw new NotFoundSignal();
}

export function revalidatePath(p: string) {
  nav.revalidated.push(p);
}

export function cookies() {
  return { getAll: () => [], set: () => {} };
}

/** Runs an action and returns the URL it redirected to. Fails if it did not redirect. */
export async function redirectOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (e) {
    if (e instanceof RedirectSignal) return e.url;
    throw e;
  }
  throw new Error("Expected a redirect, but the action finished normally");
}
