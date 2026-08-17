import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { connectOperations, operationsApi, type Boat, type Trip } from './operationsApi';

type OperationsData = {
  userId: string;
  boats: Boat[];
  trips: Trip[];
};

type OperationsStatus = {
  userId: string;
  loading: boolean;
  error: string;
};

type ReloadState = {
  userId: string;
  rerun: boolean;
  promise: Promise<void>;
};

export function useOperations() {
  const { session } = useAuth();
  const userId = session?.userId;
  const [data, setData] = useState<OperationsData>();
  const [status, setStatus] = useState<OperationsStatus>();
  const latestUserId = useRef(userId);
  const reloadState = useRef<ReloadState | undefined>(undefined);

  useEffect(() => {
    latestUserId.current = userId;
    return () => {
      if (latestUserId.current === userId) latestUserId.current = undefined;
    };
  }, [userId]);

  const reload = useCallback((): Promise<void> => {
    if (!session) return Promise.resolve();

    const requestUserId = session.userId;
    const existing = reloadState.current;
    if (existing?.userId === requestUserId) {
      existing.rerun = true;
      return existing.promise;
    }

    const state: ReloadState = {
      userId: requestUserId,
      rerun: false,
      promise: Promise.resolve(),
    };

    const loadOnce = async () => {
      setStatus((current) => current?.userId === requestUserId
        ? { ...current, error: '' }
        : { userId: requestUserId, loading: true, error: '' });
      try {
        const [boats, trips] = await Promise.all([
          operationsApi.boats(session.accessToken),
          operationsApi.trips(session.accessToken),
        ]);
        if (latestUserId.current !== requestUserId) return;
        setData({ userId: requestUserId, boats, trips });
        setStatus({ userId: requestUserId, loading: false, error: '' });
      } catch (reason) {
        if (latestUserId.current !== requestUserId) return;
        setStatus({
          userId: requestUserId,
          loading: false,
          error: reason instanceof Error ? reason.message : 'Unable to load operations.',
        });
      }
    };

    state.promise = (async () => {
      do {
        state.rerun = false;
        await loadOnce();
      } while (state.rerun && latestUserId.current === requestUserId);
    })().finally(() => {
      if (reloadState.current === state) reloadState.current = undefined;
    });
    reloadState.current = state;
    return state.promise;
  }, [session]);

  useEffect(() => {
    void reload();
    if (!session) return;
    const disconnect = connectOperations(session.accessToken, () => void reload());
    const interval = window.setInterval(() => void reload(), 10_000);
    return () => {
      disconnect();
      window.clearInterval(interval);
    };
  }, [reload, session]);

  const currentData = data?.userId === userId ? data : undefined;
  const currentStatus = status?.userId === userId ? status : undefined;
  return {
    boats: currentData?.boats ?? [],
    trips: currentData?.trips ?? [],
    loading: Boolean(session) && (currentStatus?.loading ?? true),
    error: currentStatus?.error ?? '',
    reload,
    token: session?.accessToken,
  };
}
