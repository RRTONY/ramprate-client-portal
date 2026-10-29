/** Tests run on plain React 18 without `cache`, and each call must see the current fake state. */
export const cache = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
