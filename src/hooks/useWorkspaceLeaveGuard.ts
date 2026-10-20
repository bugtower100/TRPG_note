import { createContext, useContext, useEffect, type MutableRefObject } from 'react';

type LeaveGuard = (() => Promise<boolean>) | null;

export const WorkspaceLeaveContext = createContext<MutableRefObject<LeaveGuard> | null>(null);

export function useWorkspaceLeaveGuard(guard: LeaveGuard) {
  const slot = useContext(WorkspaceLeaveContext);
  useEffect(() => {
    if (!slot) return;
    slot.current = guard;
    return () => { slot.current = null; };
  }, [guard, slot]);
}
