import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { connectOperations } from '../../operations/operationsApi';
import { complaintRequest } from './complaintApi';

export function useComplaintData<T>(path: string | null, live = false) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>();
  const key = `${session?.userId}:${path}`;
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    if (!token || !path) return;
    let active = true;
    let generation = 0;
    const load = () => {
      const current = ++generation;
      void complaintRequest<T>(token, path).then(data => {
        if (active && current === generation) setState({ key, data, loading: false });
      }).catch((error: unknown) => {
        if (active && current === generation) setState(s => ({ key,
          data: error instanceof Error && 'status' in error && [401, 403, 404].includes(Number(error.status)) ? undefined : s?.key === key ? s.data : undefined,
          loading: false, error: error instanceof Error ? error.message : 'Unable to load records.' }));
      });
    };
    load();
    const disconnect = live ? connectOperations(token, load) : undefined;
    const interval = live ? window.setInterval(load, 15000) : undefined;
    const focus = () => load();
    window.addEventListener('focus', focus);
    return () => { active = false; disconnect?.(); window.clearInterval(interval); window.removeEventListener('focus', focus); };
  }, [path, token, key, live, version]);
  const current = state?.key === key ? state : undefined;
  return { data: current?.data, loading: path ? current?.loading ?? true : false, error: current?.error, reload, token };
}
