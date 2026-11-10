import { randomUUID } from 'expo-crypto';

// A logical write retains this identifier and its original body until resolved.
export function newSimulationEventId(): string { return randomUUID(); }
