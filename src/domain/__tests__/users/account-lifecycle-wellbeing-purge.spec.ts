import { AccountLifecycleService } from '../../../use-cases/auth/account-lifecycle.service';
import { WellbeingCaptureCoordinator } from '../../../use-cases/wellbeing-history/wellbeing-capture-coordinator.service';

describe('AccountLifecycleService wellbeing purge', () => {
  it('removes wellbeing observations before deleting the user account', async () => {
    const userRepository = {
      findScheduledForDeletionDueBefore: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined)
    };
    const reflectiveProfiles = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const states = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const ledger = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const wellbeing = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const coordinator = new WellbeingCaptureCoordinator();
    const service = new AccountLifecycleService(
      { get: jest.fn() } as never,
      userRepository as never,
      reflectiveProfiles as never,
      states as never,
      ledger as never,
      wellbeing as never,
      coordinator
    );

    await service.purgeUserAccount('user-id');

    expect(reflectiveProfiles.deleteByUserId).toHaveBeenCalledWith('user-id');
    expect(states.deleteByUserId).toHaveBeenCalledWith('user-id');
    expect(ledger.deleteByUserId).toHaveBeenCalledWith('user-id');
    expect(wellbeing.deleteByUserId).toHaveBeenCalledWith('user-id');
    expect(userRepository.delete).toHaveBeenCalledWith('user-id');
  });

  it('blocks new captures and drains an in-flight capture before purging', async () => {
    let finishCapture!: () => void;
    const captureFinished = new Promise<void>((resolve) => {
      finishCapture = resolve;
    });
    const coordinator = new WellbeingCaptureCoordinator();
    const pendingCapture = coordinator.run('user-id', () => captureFinished);
    const userRepository = {
      findScheduledForDeletionDueBefore: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined)
    };
    const reflectiveProfiles = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const states = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const ledger = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const wellbeing = { deleteByUserId: jest.fn().mockResolvedValue(undefined) };
    const service = new AccountLifecycleService(
      { get: jest.fn() } as never,
      userRepository as never,
      reflectiveProfiles as never,
      states as never,
      ledger as never,
      wellbeing as never,
      coordinator
    );

    const purge = service.purgeUserAccount('user-id');
    await Promise.resolve();

    expect(wellbeing.deleteByUserId).not.toHaveBeenCalled();
    expect(coordinator.run('user-id', () => Promise.resolve())).toBeUndefined();

    finishCapture();
    await pendingCapture;
    await purge;

    expect(wellbeing.deleteByUserId).toHaveBeenCalledWith('user-id');
    expect(userRepository.delete).toHaveBeenCalledWith('user-id');
  });
});
