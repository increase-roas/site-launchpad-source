import { cloneNode, type PaidFunnelGraph } from "./graph";

export type HistoryState = {
  past: PaidFunnelGraph[];
  present: PaidFunnelGraph;
  future: PaidFunnelGraph[];
};

export function createHistory(present: PaidFunnelGraph): HistoryState {
  return { past: [], present: cloneNode(present), future: [] };
}

export function pushHistory(state: HistoryState, next: PaidFunnelGraph, limit = 80): HistoryState {
  if (JSON.stringify(state.present) === JSON.stringify(next)) return state;
  return {
    past: [...state.past, cloneNode(state.present)].slice(-limit),
    present: cloneNode(next),
    future: [],
  };
}

export function undoHistory(state: HistoryState): HistoryState {
  const previous = state.past[state.past.length - 1];
  if (!previous) return state;
  return {
    past: state.past.slice(0, -1),
    present: cloneNode(previous),
    future: [cloneNode(state.present), ...state.future],
  };
}

export function redoHistory(state: HistoryState): HistoryState {
  const next = state.future[0];
  if (!next) return state;
  return {
    past: [...state.past, cloneNode(state.present)],
    present: cloneNode(next),
    future: state.future.slice(1),
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}
