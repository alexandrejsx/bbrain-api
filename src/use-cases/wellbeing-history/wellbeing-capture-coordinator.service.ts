export class WellbeingCaptureCoordinator {
  private readonly blockedUsers = new Set<string>();
  private readonly pendingByUser = new Map<string, Set<Promise<unknown>>>();
  private readonly tailByUser = new Map<string, Promise<unknown>>();

  run<T>(userId: string, task: () => Promise<T>): Promise<T> | undefined {
    if (this.blockedUsers.has(userId)) return undefined;

    const previous = this.tailByUser.get(userId) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(task);
    const tracked = pending.finally(() => {
      const userTasks = this.pendingByUser.get(userId);
      userTasks?.delete(tracked);
      if (userTasks?.size === 0) this.pendingByUser.delete(userId);
      if (this.tailByUser.get(userId) === tracked) this.tailByUser.delete(userId);
    });
    const userTasks = this.pendingByUser.get(userId) ?? new Set<Promise<unknown>>();
    userTasks.add(tracked);
    this.pendingByUser.set(userId, userTasks);
    this.tailByUser.set(userId, tracked);

    return tracked;
  }

  async blockAndDrain(userId: string): Promise<void> {
    this.blockedUsers.add(userId);
    const pending = [...(this.pendingByUser.get(userId) ?? [])];
    await Promise.allSettled(pending);
  }
}
