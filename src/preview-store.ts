import { randomUUID } from "node:crypto";
import type { PreviewRecord, UnknownRecord } from "./types.js";

export class PreviewStore {
  private readonly previews = new Map<string, PreviewRecord>();

  constructor(private readonly ttlMs = 10 * 60_000) {}

  create(upstreamArgs: UnknownRecord, upstreamResult: UnknownRecord) {
    this.sweep();
    const token = randomUUID();
    this.previews.set(token, {
      upstreamArgs: structuredClone(upstreamArgs),
      upstreamResult: structuredClone(upstreamResult),
      expiresAt: Date.now() + this.ttlMs
    });
    return { token, expiresAt: Date.now() + this.ttlMs };
  }

  consume(token: string): PreviewRecord | undefined {
    const preview = this.previews.get(token);
    this.previews.delete(token);
    if (!preview || preview.expiresAt <= Date.now()) return undefined;
    return preview;
  }

  private sweep() {
    const now = Date.now();
    for (const [token, preview] of this.previews) {
      if (preview.expiresAt <= now) this.previews.delete(token);
    }
  }
}

