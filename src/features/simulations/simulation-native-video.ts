import type { VideoPlayer } from 'expo-video';
/** Expo's imperative native handle; only used before a server-approved START. */
export function positionNativeVideo(player: VideoPlayer, milliseconds: number) {
  player.pause();
  player.currentTime = milliseconds / 1000;
}
