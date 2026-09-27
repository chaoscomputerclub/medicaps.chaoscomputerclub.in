import type { ServerEventEnvelope } from "./eventTypes";

/**
 * Bounded Event Deduplicator and Monotonic Version Tracker.
 * Protects client-side state from replay storms, duplicate events across tabs,
 * and out-of-order delivery.
 */
export class EventDeduplicator {
  private maxCapacity: number;
  private eventIds: Set<string>;
  private insertionOrder: string[];
  private aggregateVersions: Map<string, number>;
  private aggregateVersionOrder: string[];

  constructor(maxCapacity = 1000) {
    this.maxCapacity = maxCapacity;
    this.eventIds = new Set();
    this.insertionOrder = [];
    this.aggregateVersions = new Map();
    this.aggregateVersionOrder = [];
  }

  /**
   * Evaluates an incoming event against deduplication and version ordering rules.
   * Returns true if event is valid and should be processed; false if duplicate or stale.
   */
  public shouldProcess(event: ServerEventEnvelope): boolean {
    const eventId = event.id || (event as any).event_id;

    // 1. Exact Event ID Deduplication via Bounded LRU Set
    if (eventId) {
      if (this.eventIds.has(eventId)) {
        return false;
      }
      this.recordEventId(eventId);
    }

    // 2. Monotonic Version Guard
    const version = event.version;
    const aggregate = event.aggregate || (event.contest_slug ? "contest" : undefined);
    const aggregateId = event.aggregate_id || event.contest_slug;

    if (typeof version === "number" && aggregate && aggregateId) {
      const key = `${aggregate}:${aggregateId}`;
      const lastVersion = this.aggregateVersions.get(key);

      if (lastVersion !== undefined && version <= lastVersion) {
        // Drop stale or previously applied event version
        return false;
      }

      this.aggregateVersions.set(key, version);

      // Bounded eviction for aggregateVersions — same capacity cap as eventIds
      if (!this.aggregateVersionOrder.includes(key)) {
        this.aggregateVersionOrder.push(key);
        if (this.aggregateVersionOrder.length > this.maxCapacity) {
          const oldest = this.aggregateVersionOrder.shift();
          if (oldest) this.aggregateVersions.delete(oldest);
        }
      }
    }

    return true;
  }

  private recordEventId(id: string) {
    this.eventIds.add(id);
    this.insertionOrder.push(id);

    // Evict oldest items when exceeding bounded capacity
    if (this.insertionOrder.length > this.maxCapacity) {
      const oldest = this.insertionOrder.shift();
      if (oldest) {
        this.eventIds.delete(oldest);
      }
    }
  }

  /**
   * Resets all tracking state (called on user logout or session reset).
   */
  public reset(): void {
    this.eventIds.clear();
    this.insertionOrder = [];
    this.aggregateVersions.clear();
    this.aggregateVersionOrder = [];
  }

  public getTrackedCount(): number {
    return this.eventIds.size;
  }
}

export const globalEventDeduplicator = new EventDeduplicator();
