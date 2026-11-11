// Which explainer on the page owns the keyboard, and whether two of them
// would write the same URL-hash keys. Module-level state, deliberately: the
// explainers don't know about each other, and nothing here runs at module
// evaluation, so it is SSR-safe.

interface Entry {
  token: object;
  /** null: not linked to the URL, so it takes no part in the collision check. */
  namespace: string | null;
  /** false: keys={false}, so it never owns the keyboard. */
  keyed: boolean;
}

const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

let entries: Entry[] = [];
let activeToken: object | null = null;
let warned = false;

/**
 * Add an explainer. `namespace` is its hash id ("" without one); pass null
 * when it keeps nothing in the URL. `keyed: false` keeps it out of key
 * routing. Returns the unregister function.
 */
export function register(token: object, namespace: string | null, keyed = true): () => void {
  if (isDev && !warned && namespace !== null && entries.some((e) => e.namespace === namespace)) {
    warned = true;
    const keys = namespace === "" ? '"frame" and "in"' : `"${namespace}.frame" and "${namespace}.in"`;
    console.warn(`[stepwise] Two explainers share the hash keys ${keys}. Give each an \`id\` prop.`);
  }
  entries.push({ token, namespace, keyed });
  return () => {
    entries = entries.filter((e) => e.token !== token);
    if (activeToken === token) activeToken = null;
  };
}

/**
 * The reader touched this explainer last (pointer or focus). Ignored for one
 * without keys: touching it must not take the keyboard from the others.
 */
export function activate(token: object): void {
  if (entries.some((e) => e.token === token && e.keyed)) activeToken = token;
}

/**
 * The last keyed one the reader touched. Until the reader clicks or focuses
 * one, none is: the keys belong to the page (Space scrolls it), not to
 * whichever explainer happened to mount first. Same after the active one
 * unmounts.
 */
export function isActive(token: object): boolean {
  return activeToken !== null && activeToken === token;
}

/** Test-only: forget every explainer and the once-per-page warning. */
export function __resetRegistryForTests(): void {
  entries = [];
  activeToken = null;
  warned = false;
}
