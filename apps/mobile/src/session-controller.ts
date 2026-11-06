/** Owns session identity independently of React and fences delayed network/storage work. */
export type SessionState<Account> = { token: string | null; me: Account | null; loading: boolean; error: string };
export class SessionController<Account> {
  private state: SessionState<Account> = { token: null, me: null, loading: true, error: "" };
  private generation = 0;
  private loadGeneration = 0;
  private writes: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(private readonly io: {
    read(): Promise<string | null>; write(token: string | null): Promise<void>;
    load(token: string): Promise<Account>; expired(error: unknown): boolean;
  }) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  cancelPending = () => { this.generation++; this.loadGeneration++; };
  private publish(patch: Partial<SessionState<Account>>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private save(token: string | null, generation: number) {
    const write = this.writes.catch(() => undefined).then(async () => {
      if (generation !== this.generation) return;
      try { await this.io.write(token); }
      catch { throw new Error("Could not update secure sign-in storage. Please try again."); }
    });
    this.writes = write;
    return write;
  }
  private async load(token: string, generation: number) {
    const loadGeneration = ++this.loadGeneration;
    try {
      const me = await this.io.load(token);
      if (generation === this.generation && loadGeneration === this.loadGeneration) this.publish({ me, error: "" });
    } catch (error) {
      if (generation !== this.generation || loadGeneration !== this.loadGeneration) return;
      if (this.io.expired(error)) {
        this.publish({ token: null, me: null });
        await this.save(null, generation);
      }
      if (generation !== this.generation || loadGeneration !== this.loadGeneration) return;
      this.publish({ error: error instanceof Error ? error.message : "Could not restore your session." });
      throw error;
    }
  }
  async restore() {
    const generation = ++this.generation;
    try {
      const token = await this.io.read();
      if (generation !== this.generation) return;
      this.publish({ token, me: null });
      if (token) await this.load(token, generation);
    } catch (error) {
      if (generation === this.generation) this.publish({ error: error instanceof Error ? error.message : "Could not restore your session." });
    } finally { if (generation === this.generation) this.publish({ loading: false }); }
  }
  async authenticate(issue: () => Promise<{ token: string }>) {
    const generation = ++this.generation;
    const { token } = await issue();
    if (generation !== this.generation) throw new Error("Sign-in was cancelled. Please try again.");
    await this.save(token, generation);
    if (generation !== this.generation) return;
    this.publish({ token, me: null, error: "", loading: false });
    await this.load(token, generation);
  }
  async refresh() {
    if (this.state.token) await this.load(this.state.token, this.generation);
  }
  async signOut(revoke: (token: string) => Promise<unknown>) {
    const token = this.state.token;
    const generation = ++this.generation;
    this.publish({ token: null, me: null, loading: false, error: "" });
    const [storage, server] = await Promise.allSettled([this.save(null, generation), token ? revoke(token) : Promise.resolve()]);
    if (generation !== this.generation) return;
    if (storage.status === "rejected") {
      this.publish({ error: "Secure storage could not be cleared. Reconnect and sign out again before sharing this device." });
      throw storage.reason;
    }
    if (server.status === "rejected" && !this.io.expired(server.reason)) {
      this.publish({ error: "Signed out on this device. The server session could not be revoked. Sign in when connected to sign out all devices." });
    }
  }
  /** Global revocation and deletion require server confirmation; preserve retry access on failure. */
  async confirmAndClear(action: (token: string) => Promise<unknown>, allowExpired = false) {
    const token = this.state.token;
    const generation = this.generation;
    if (!token) return;
    try { await action(token); }
    catch (error) { if (!allowExpired || !this.io.expired(error)) throw error; }
    if (generation !== this.generation || token !== this.state.token) return;
    await this.signOut(async () => undefined);
  }
}
