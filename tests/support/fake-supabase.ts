// In-memory stand-in for the Supabase clients used by the app (lib/supabase/server and @supabase/ssr).
// It stores rows per table and supports the query methods the app calls. It does NOT apply row
// level security: that is tested against a real staging project in tests/rls.
import { randomUUID } from "node:crypto";

export type Row = Record<string, unknown>;
type DbError = { message: string };
type Result = { data: unknown; error: DbError | null };
type Filter = {
  op: "eq" | "neq" | "gte" | "lte" | "in";
  column: string;
  value: unknown;
};
export type Call = {
  client: "user" | "service";
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  payload?: unknown;
  filters: Filter[];
  options?: { onConflict?: string; ignoreDuplicates?: boolean };
};
type Handler = (call: Call) => Result | undefined;

const PRIMARY_KEYS: Record<string, string[]> = {
  staff_clients: ["user_id", "client_id"],
};

const fresh = () => ({
  tables: {} as Record<string, Row[]>,
  calls: [] as Call[],
  handlers: [] as Handler[],
  user: null as { id: string; email: string } | null,
  aal: null as { currentLevel: string; nextLevel: string } | null,
  storageObjects: {} as Record<string, { name: string; metadata: Row }[]>,
  storageRemoved: [] as string[],
  signedUrls: [] as { path: string; expiresIn: number; options?: Row }[],
  signError: null as DbError | null,
  createdUsers: [] as Row[],
  createUserError: null as DbError | null,
  userUpdates: [] as { id: string; attrs: Row }[],
  userUpdateError: null as DbError | null,
  passwordChanges: [] as string[],
  passwordChangeError: null as DbError | null,
  deletedUsers: [] as string[],
  rpcs: [] as { fn: string; args: unknown }[],
  otpChecks: [] as Row[],
  otpError: null as DbError | null,
  codeExchanges: [] as string[],
  signedOut: false,
  serviceClients: 0,
});

export const db = fresh();

export function resetDb() {
  Object.assign(db, fresh());
}

export function table(name: string): Row[] {
  return (db.tables[name] ??= []);
}

export function seed(name: string, ...rows: Row[]) {
  table(name).push(...rows);
}

/** Overrides the result for matching calls. Return undefined from fn to fall through. */
export function on(
  tableName: string,
  action: Call["action"],
  result: Result | ((call: Call) => Result | undefined),
) {
  db.handlers.unshift((call) =>
    call.table === tableName && call.action === action
      ? typeof result === "function"
        ? result(call)
        : result
      : undefined,
  );
}

/** Calls made against a table, optionally limited to one action. */
export function callsTo(tableName: string, action?: Call["action"]) {
  return db.calls.filter(
    (c) => c.table === tableName && (!action || c.action === action),
  );
}

const matches = (row: Row, filters: Filter[]) =>
  filters.every((f) => {
    const v = row[f.column];
    switch (f.op) {
      case "eq":
        return v === f.value;
      case "neq":
        return v !== f.value;
      case "gte":
        return String(v) >= String(f.value);
      case "lte":
        return String(v) <= String(f.value);
      case "in":
        return (f.value as unknown[]).includes(v);
    }
  });

class Query implements PromiseLike<Result> {
  private call: Call;
  private mode: "many" | "single" | "maybeSingle" = "many";
  private max = Infinity;

  constructor(client: Call["client"], tableName: string) {
    this.call = { client, table: tableName, action: "select", filters: [] };
  }

  select() {
    return this;
  }
  insert(payload: Row | Row[]) {
    return this.write("insert", payload);
  }
  update(payload: Row) {
    return this.write("update", payload);
  }
  upsert(payload: Row | Row[], options?: Call["options"]) {
    this.call.options = options;
    return this.write("upsert", payload);
  }
  delete() {
    this.call.action = "delete";
    return this;
  }
  private write(action: Call["action"], payload: unknown) {
    this.call.action = action;
    this.call.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    return this.filter("eq", column, value);
  }
  neq(column: string, value: unknown) {
    return this.filter("neq", column, value);
  }
  gte(column: string, value: unknown) {
    return this.filter("gte", column, value);
  }
  lte(column: string, value: unknown) {
    return this.filter("lte", column, value);
  }
  in(column: string, value: unknown[]) {
    return this.filter("in", column, value);
  }
  private filter(op: Filter["op"], column: string, value: unknown) {
    this.call.filters.push({ op, column, value });
    return this;
  }

  order() {
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybeSingle";
    return this;
  }

  then<A = Result, B = never>(
    ok?: ((r: Result) => A | PromiseLike<A>) | null,
    fail?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(ok, fail);
  }

  private run(): Result {
    db.calls.push(this.call);
    for (const h of db.handlers) {
      const r = h(this.call);
      if (r) return r;
    }
    const rows = this.execute().slice(0, this.max);
    if (this.mode === "many") return { data: rows, error: null };
    if (rows.length === 1) return { data: rows[0], error: null };
    if (this.mode === "maybeSingle" && rows.length === 0)
      return { data: null, error: null };
    return { data: null, error: { message: `expected one row, got ${rows.length}` } };
  }

  private execute(): Row[] {
    const { action, filters, payload } = this.call;
    const rows = table(this.call.table);
    if (action === "select") return rows.filter((r) => matches(r, filters));
    if (action === "delete") {
      const gone = rows.filter((r) => matches(r, filters));
      db.tables[this.call.table] = rows.filter((r) => !gone.includes(r));
      return gone;
    }
    if (action === "update") {
      const hit = rows.filter((r) => matches(r, filters));
      hit.forEach((r) => Object.assign(r, payload));
      return hit;
    }
    const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
    return list.flatMap((input) => {
      const keys = this.call.options?.onConflict?.split(",") ??
        PRIMARY_KEYS[this.call.table] ?? ["id"];
      const existing =
        action === "upsert" && keys.every((k) => input[k] !== undefined)
          ? rows.find((r) => keys.every((k) => r[k] === input[k]))
          : undefined;
      if (existing) {
        if (!this.call.options?.ignoreDuplicates)
          Object.assign(existing, input);
        return [existing];
      }
      const row = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
      rows.push(row);
      return [row];
    });
  }
}

function makeClient(kind: Call["client"]) {
  if (kind === "service") db.serviceClients++;
  return {
    from: (tableName: string) => new Query(kind, tableName),
    rpc: async (fn: string, args: unknown) => {
      db.rpcs.push({ fn, args });
      return { data: null, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string, opts?: { search?: string }) => ({
          data: (db.storageObjects[`${bucket}/${prefix}`] ?? []).filter(
            (o) => !opts?.search || o.name.includes(opts.search),
          ),
          error: null,
        }),
        remove: async (paths: string[]) => {
          db.storageRemoved.push(...paths);
          return { data: null, error: null };
        },
        createSignedUrl: async (
          path: string,
          expiresIn: number,
          options?: Row,
        ) => {
          db.signedUrls.push({ path, expiresIn, options });
          if (db.signError) return { data: null, error: db.signError };
          return {
            data: { signedUrl: `https://storage.test/${bucket}/${path}?token=t` },
            error: null,
          };
        },
      }),
    },
    auth: {
      getUser: async () => ({ data: { user: db.user }, error: null }),
      signOut: async () => {
        db.signedOut = true;
        return { error: null };
      },
      updateUser: async ({ password }: { password: string }) => {
        db.passwordChanges.push(password);
        return { data: { user: db.user }, error: db.passwordChangeError };
      },
      verifyOtp: async (args: Row) => {
        db.otpChecks.push(args);
        return { data: {}, error: db.otpError };
      },
      exchangeCodeForSession: async (code: string) => {
        db.codeExchanges.push(code);
        return { data: {}, error: db.otpError };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: db.aal,
          error: null,
        }),
      },
      admin: {
        createUser: async (attrs: Row) => {
          db.createdUsers.push(attrs);
          if (db.createUserError) return { data: { user: null }, error: db.createUserError };
          return { data: { user: { id: randomUUID(), email: attrs.email } }, error: null };
        },
        updateUserById: async (id: string, attrs: Row) => {
          db.userUpdates.push({ id, attrs });
          return { data: { user: { id } }, error: db.userUpdateError };
        },
        deleteUser: async (id: string) => {
          db.deletedUsers.push(id);
          return { data: {}, error: null };
        },
      },
    },
  };
}

export function createClient() {
  return makeClient("user");
}

export function createServiceClient() {
  return makeClient("service");
}

/** Same shape as @supabase/ssr's createServerClient, used by middleware.ts. */
export function createServerClient(..._args: unknown[]) {
  return makeClient("user");
}
