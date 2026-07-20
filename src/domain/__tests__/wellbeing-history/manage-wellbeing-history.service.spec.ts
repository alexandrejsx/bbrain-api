import { DailyMoodSummaryProjectorService } from '../../../use-cases/wellbeing-history/daily-mood-summary-projector.service';
import { WellbeingObservation } from '../../wellbeing-history/entities/wellbeing-observation.entity';
import {
  InvalidWellbeingObservationError,
  ManageWellbeingHistoryService,
  WellbeingObservationIdempotencyConflictError,
  WellbeingObservationNotFoundError,
  WellbeingObservationRevisionConflictError
} from '../../../use-cases/wellbeing-history/manage-wellbeing-history.service';
import { InMemoryWellbeingObservationRepository } from './support/in-memory-wellbeing-observation.repository';

function setup() {
  const repository = new InMemoryWellbeingObservationRepository();
  const eventDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const projector = new DailyMoodSummaryProjectorService(repository, eventDispatcher);
  const userRepository = {
    findById: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' })
  };
  const service = new ManageWellbeingHistoryService(
    repository,
    userRepository as never,
    eventDispatcher,
    projector
  );

  return { service, repository, eventDispatcher };
}

describe('ManageWellbeingHistoryService', () => {
  it.each([
    [
      'an invalid timezone',
      {
        kind: 'specific_day',
        localDate: '2026-07-20',
        timezone: 'Mars/Olympus',
        precision: 'exact'
      }
    ],
    [
      'an unknown precision',
      {
        kind: 'specific_day',
        localDate: '2026-07-20',
        precision: 'certain'
      }
    ],
    [
      'a datetime without an explicit offset',
      {
        kind: 'moment',
        at: '2026-07-20T12:00:00',
        precision: 'exact'
      }
    ],
    [
      'an impossible calendar datetime',
      {
        kind: 'moment',
        at: '2026-02-30T12:00:00Z',
        precision: 'exact'
      }
    ]
  ])('rejects manual temporal input with %s', async (_label, temporalReference) => {
    const { service } = setup();

    await expect(
      service.createManual({
        userId: 'user-id',
        kind: 'mood_event',
        data: { descriptors: ['calmo'] },
        temporalReference
      })
    ).rejects.toBeInstanceOf(InvalidWellbeingObservationError);
  });

  it('creates manual records idempotently without requiring a premium entitlement', async () => {
    const { service, repository } = setup();
    const input = {
      userId: 'user-id',
      clientRequestId: 'request-1',
      kind: 'sleep_record' as const,
      data: {
        quality: { value: 'ruim', precision: 'approximate' }
      },
      temporalReference: {
        kind: 'specific_night',
        localDate: '2026-07-19',
        precision: 'approximate'
      }
    };

    const first = await service.createManual(input);
    const retry = await service.createManual(input);

    expect(retry.id.value).toBe(first.id.value);
    expect(repository.observations.size).toBe(1);
    expect(first.toJson()).toMatchObject({
      kind: 'sleep_record',
      data: { quality: { value: 'ruim', precision: 'approximate' } },
      provenance: { source: 'manual' }
    });
  });

  it('applies manual data corrections as merge patches without erasing omitted sleep fields', async () => {
    const { service } = setup();
    const observation = await service.createManual({
      userId: 'user-id',
      kind: 'sleep_record',
      data: {
        durationMinutes: { value: 360, precision: 'exact' },
        quality: { value: 'poor', precision: 'exact' }
      },
      temporalReference: {
        kind: 'specific_night',
        localDate: '2026-07-19',
        precision: 'exact'
      }
    });

    const corrected = await service.correctManually({
      userId: 'user-id',
      observationId: observation.id.value,
      expectedRevision: observation.revision,
      data: { quality: { value: 'good' } }
    });

    expect(corrected.data).toEqual({
      durationMinutes: { value: 360, precision: 'exact' },
      quality: { value: 'good', precision: 'exact' }
    });
  });

  it('rejects reuse of a manual request id with different content', async () => {
    const { service } = setup();
    const base = {
      userId: 'user-id',
      clientRequestId: 'same-request',
      kind: 'mood_event' as const,
      temporalReference: { kind: 'unknown' }
    };

    await service.createManual({ ...base, data: { descriptors: ['calmo'] } });

    await expect(
      service.createManual({ ...base, data: { descriptors: ['ansioso'] } })
    ).rejects.toBeInstanceOf(WellbeingObservationIdempotencyConflictError);
  });

  it('derives only a partial daily summary after two primary mood events', async () => {
    const { service } = setup();

    const first = await service.createManual({
      userId: 'user-id',
      clientRequestId: 'mood-1',
      kind: 'mood_event',
      data: { descriptors: ['ansioso'] },
      temporalReference: {
        kind: 'moment',
        at: '2026-07-20T12:00:00.000Z',
        precision: 'exact'
      }
    });
    expect(
      (await service.list('user-id')).filter((item) => item.kind === 'mood_daily_summary')
    ).toHaveLength(0);

    const second = await service.createManual({
      userId: 'user-id',
      clientRequestId: 'mood-2',
      kind: 'mood_event',
      data: { descriptors: ['aliviado'] },
      temporalReference: {
        kind: 'moment',
        at: '2026-07-20T20:00:00.000Z',
        precision: 'exact'
      }
    });
    const summaries = (await service.list('user-id')).filter(
      (item): item is WellbeingObservation<'mood_daily_summary'> =>
        item.kind === 'mood_daily_summary'
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0].data).toMatchObject({
      descriptors: expect.arrayContaining(['ansioso', 'aliviado']),
      sourceObservationIds: expect.arrayContaining([first.id.value, second.id.value]),
      coverage: 'partial',
      status: 'current',
      summarySource: 'derived'
    });
    expect(summaries[0].data).not.toHaveProperty('explicitRating');
  });

  it('does not serve a derived summary whose source set missed a newly persisted event', async () => {
    const { service, repository } = setup();
    for (const [index, descriptor] of ['ansioso', 'aliviado'].entries()) {
      await service.createManual({
        userId: 'user-id',
        clientRequestId: `source-set-${index}`,
        kind: 'mood_event',
        data: { descriptors: [descriptor] },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          precision: 'exact'
        }
      });
    }

    const unprojected = WellbeingObservation.create({
      userId: 'user-id',
      idempotencyKey: 'unprojected-mood-event',
      kind: 'mood_event',
      data: { descriptors: ['cansado'] },
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-07-20',
        timezone: 'America/Sao_Paulo',
        precision: 'exact'
      },
      provenance: { source: 'manual' }
    });
    await repository.saveIfAbsent('user-id', unprojected.idempotencyKey, unprojected);

    const visible = await service.list('user-id');
    expect(visible.filter((item) => item.kind === 'mood_event')).toHaveLength(3);
    expect(visible.filter((item) => item.kind === 'mood_daily_summary')).toHaveLength(0);
  });

  it('projects mood events tied to a specific night onto that local date', async () => {
    const { service } = setup();
    for (const [index, descriptor] of ['agitado', 'aliviado'].entries()) {
      await service.createManual({
        userId: 'user-id',
        clientRequestId: `night-mood-${index}`,
        kind: 'mood_event',
        data: { descriptors: [descriptor] },
        temporalReference: {
          kind: 'specific_night',
          localDate: '2026-07-19',
          precision: 'exact'
        }
      });
    }

    const summary = (await service.list('user-id')).find(
      (item) => item.kind === 'mood_daily_summary'
    );
    expect(summary?.temporalReference).toMatchObject({
      kind: 'specific_day',
      localDate: '2026-07-19'
    });
  });

  it('caps a derived summary deterministically at the aggregate descriptor limit', async () => {
    const { service } = setup();
    for (let index = 0; index < 13; index += 1) {
      await service.createManual({
        userId: 'user-id',
        clientRequestId: `descriptor-cap-${index}`,
        kind: 'mood_event',
        data: { descriptors: [`emoção-${String(index).padStart(2, '0')}`] },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          precision: 'exact'
        }
      });
    }

    const current = (await service.list('user-id')).find(
      (item) =>
        item.kind === 'mood_daily_summary' &&
        (item.data as WellbeingObservation<'mood_daily_summary'>['data']).status === 'current'
    ) as WellbeingObservation<'mood_daily_summary'> | undefined;
    expect(current?.data.descriptors).toHaveLength(12);
    expect(current?.data.sourceObservationIds).toHaveLength(13);
  });

  it('invalidates and rebuilds a derived summary after a source correction', async () => {
    const { service } = setup();
    const first = await service.createManual({
      userId: 'user-id',
      clientRequestId: 'mood-1',
      kind: 'mood_event',
      data: { descriptors: ['tristeza'] },
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-07-20',
        precision: 'exact'
      }
    });
    await service.createManual({
      userId: 'user-id',
      clientRequestId: 'mood-2',
      kind: 'mood_event',
      data: { descriptors: ['alívio'] },
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-07-20',
        precision: 'exact'
      }
    });

    await service.correctManually({
      userId: 'user-id',
      observationId: first.id.value,
      expectedRevision: 1,
      data: { descriptors: ['frustração'] }
    });
    const summaries = (await service.list('user-id')).filter(
      (item): item is WellbeingObservation<'mood_daily_summary'> =>
        item.kind === 'mood_daily_summary'
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0].data).toMatchObject({
      descriptors: expect.arrayContaining(['frustração', 'alívio']),
      status: 'current',
      summarySource: 'derived'
    });
    expect(summaries[0].revisionHistory.map((revision) => revision.operation)).toEqual(
      expect.arrayContaining(['projection_marked_stale', 'projection_refreshed'])
    );
  });

  it('lets a manual daily summary override derived summaries without deleting events', async () => {
    const { service } = setup();
    for (const [index, descriptor] of ['ansioso', 'bem'].entries()) {
      await service.createManual({
        userId: 'user-id',
        clientRequestId: `event-${index}`,
        kind: 'mood_event',
        data: { descriptors: [descriptor] },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          precision: 'exact'
        }
      });
    }

    const manual = await service.createManual({
      userId: 'user-id',
      clientRequestId: 'manual-summary',
      kind: 'mood_daily_summary',
      data: { descriptors: ['misto'], coverage: 'sufficient' },
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-07-20',
        precision: 'exact'
      }
    });
    const all = await service.list('user-id');

    expect(manual.data).toMatchObject({
      descriptors: ['misto'],
      status: 'current',
      summarySource: 'manual_override'
    });
    const summaries = all.filter(
      (item): item is WellbeingObservation<'mood_daily_summary'> =>
        item.kind === 'mood_daily_summary'
    );
    expect(summaries.find((item) => item.data.summarySource === 'derived')?.data).toMatchObject({
      status: 'stale'
    });
    expect(all.filter((item) => item.kind === 'mood_event')).toHaveLength(2);
  });

  it('restores the matching derived summary after a manual override is deleted', async () => {
    const { service } = setup();
    for (const [index, descriptor] of ['ansioso', 'aliviado'].entries()) {
      await service.createManual({
        userId: 'user-id',
        clientRequestId: `event-${index}`,
        kind: 'mood_event',
        data: { descriptors: [descriptor] },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          precision: 'exact'
        }
      });
    }
    const override = await service.createManual({
      userId: 'user-id',
      clientRequestId: 'manual-summary',
      kind: 'mood_daily_summary',
      data: { descriptors: ['misto'], coverage: 'sufficient' },
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-07-20',
        precision: 'exact'
      }
    });

    await service.remove('user-id', override.id.value, override.revision);

    const summaries = (await service.list('user-id')).filter(
      (item): item is WellbeingObservation<'mood_daily_summary'> =>
        item.kind === 'mood_daily_summary'
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0].data).toMatchObject({
      descriptors: expect.arrayContaining(['ansioso', 'aliviado']),
      status: 'current',
      summarySource: 'derived'
    });
    expect(summaries[0].data).not.toHaveProperty('staleReason');
  });

  it('does not immediately recreate a derived summary that the user deleted', async () => {
    const { service } = setup();
    for (const [index, descriptor] of ['ansioso', 'aliviado'].entries()) {
      await service.createManual({
        userId: 'user-id',
        clientRequestId: `delete-derived-${index}`,
        kind: 'mood_event',
        data: { descriptors: [descriptor] },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-07-20',
          precision: 'exact'
        }
      });
    }
    const derived = (await service.list('user-id')).find(
      (item): item is WellbeingObservation<'mood_daily_summary'> =>
        item.kind === 'mood_daily_summary' &&
        (item.data as WellbeingObservation<'mood_daily_summary'>['data']).summarySource ===
          'derived'
    );
    if (!derived) throw new Error('Expected a derived summary');

    await service.remove('user-id', derived.id.value, derived.revision);

    expect(
      (await service.list('user-id')).filter((item) => item.kind === 'mood_daily_summary')
    ).toHaveLength(0);
  });

  it('rebuilds both affected dates when a mood event moves to another day', async () => {
    const { service } = setup();
    const events: WellbeingObservation<'mood_event'>[] = [];

    for (const [index, descriptor] of ['ansioso', 'aliviado', 'cansado'].entries()) {
      events.push(
        (await service.createManual({
          userId: 'user-id',
          clientRequestId: `event-${index}`,
          kind: 'mood_event',
          data: { descriptors: [descriptor] },
          temporalReference: {
            kind: 'specific_day',
            localDate: '2026-07-20',
            precision: 'exact'
          }
        })) as WellbeingObservation<'mood_event'>
      );
    }

    await service.correctManually({
      userId: 'user-id',
      observationId: events[0].id.value,
      expectedRevision: events[0].revision,
      data: { descriptors: ['ansioso'] },
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-07-21',
        precision: 'exact'
      }
    });

    const currentSummaries = (await service.list('user-id')).filter(
      (item): item is WellbeingObservation<'mood_daily_summary'> =>
        item.kind === 'mood_daily_summary' &&
        (item.data as WellbeingObservation<'mood_daily_summary'>['data']).status === 'current'
    );
    expect(currentSummaries).toHaveLength(1);
    expect(currentSummaries[0].temporalReference).toMatchObject({
      kind: 'specific_day',
      localDate: '2026-07-20'
    });
    expect(currentSummaries[0].data.descriptors).toEqual(
      expect.arrayContaining(['aliviado', 'cansado'])
    );
    expect(currentSummaries[0].data.descriptors).not.toContain('ansioso');
  });

  it('does not disclose or delete another user observation', async () => {
    const { service } = setup();
    const observation = await service.createManual({
      userId: 'user-id',
      kind: 'mood_event',
      data: { descriptors: ['calmo'] },
      temporalReference: { kind: 'unknown' }
    });

    await expect(
      service.remove('other-user', observation.id.value, observation.revision)
    ).rejects.toBeInstanceOf(WellbeingObservationNotFoundError);
  });

  it('does not delete a record when its revision changed concurrently', async () => {
    const { service, repository } = setup();
    const observation = await service.createManual({
      userId: 'user-id',
      kind: 'mood_event',
      data: { descriptors: ['calmo'] },
      temporalReference: { kind: 'unknown' }
    });
    const repositoryDelete = jest.spyOn(repository, 'delete').mockResolvedValueOnce(false);

    await expect(
      service.remove('user-id', observation.id.value, observation.revision)
    ).rejects.toBeInstanceOf(WellbeingObservationRevisionConflictError);
    expect(repositoryDelete).toHaveBeenCalledWith(
      'user-id',
      observation.id.value,
      observation.revision
    );
    expect(repository.observations.has(observation.id.value)).toBe(true);
  });
});
