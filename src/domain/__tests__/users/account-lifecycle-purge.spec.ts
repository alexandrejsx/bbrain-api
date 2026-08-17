import { AccountLifecycleService } from '../../../modules/auth/account-lifecycle.service';

describe('AccountLifecycleService purge', () => {
  it('drains post-processing, removes every user-owned collection, then deletes the user', async () => {
    const order: string[] = [];
    const dependency = (name: string) => ({
      deleteByUserId: jest.fn(() => {
        order.push(name);
        return Promise.resolve();
      })
    });
    const users = {
      findScheduledForDeletionDueBefore: jest.fn(),
      delete: jest.fn(() => {
        order.push('user');
        return Promise.resolve();
      })
    };
    const postConversation = {
      blockAndDrain: jest.fn(() => {
        order.push('drain');
        return Promise.resolve();
      })
    };
    const sessions = dependency('sessions');
    const requests = dependency('requests');
    const currentContexts = dependency('current-context');
    const memories = dependency('memories');
    const moods = dependency('moods');
    const sleep = dependency('sleep');
    const service = new AccountLifecycleService(
      { get: jest.fn() } as never,
      users as never,
      sessions as never,
      requests as never,
      currentContexts as never,
      memories as never,
      moods as never,
      sleep as never,
      postConversation as never
    );

    await service.purgeUserAccount('user-id');

    expect(order[0]).toBe('drain');
    expect(order.at(-1)).toBe('user');
    for (const repository of [sessions, requests, currentContexts, memories, moods, sleep]) {
      expect(repository.deleteByUserId).toHaveBeenCalledWith('user-id');
    }
  });
});
