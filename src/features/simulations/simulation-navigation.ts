import { router, type Href } from 'expo-router';
import { requireUuid } from './domain/simulation-wire';

type Destination = '/simulations' | '/simulations/exams' | '/simulations/exams/random' | '/simulations/exams/presets' |
  `/simulations/scenarios/${string}` | `/simulations/exams/presets/${string}` | `/simulations/exams/sessions/${string}` |
  `/simulations/exams/results/${string}` | `/simulations/exams/review/${string}`;
export function openSimulation(pathname: Destination, params: Record<string, string> = {}, replace = false) {
  const href = { pathname, params } as Href;
  if (replace) router.replace(href); else router.push(href);
}
export function scenarioPath(id: string): `/simulations/scenarios/${string}` { requireUuid(id); return `/simulations/scenarios/${id}`; }
export function sessionPath(id: string): `/simulations/exams/sessions/${string}` { requireUuid(id); return `/simulations/exams/sessions/${id}`; }
export function resultPath(id: string): `/simulations/exams/results/${string}` { requireUuid(id); return `/simulations/exams/results/${id}`; }
export function reviewPath(id: string): `/simulations/exams/review/${string}` { requireUuid(id); return `/simulations/exams/review/${id}`; }
export function presetPath(id: string): `/simulations/exams/presets/${string}` { requireUuid(id); return `/simulations/exams/presets/${id}`; }
export function mediaClock(ms: number): string { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
