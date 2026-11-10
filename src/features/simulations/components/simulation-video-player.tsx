import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { requireMobileVideoUrl, simulationMessage } from '../simulation-api';
import { actualMediaMs, SimulationMediaClock } from '../simulation-media-clock';
import { newSimulationEventId } from '../simulation-id';
import { SimulationVideoFrame } from './simulation-video-frame';
import { positionNativeVideo } from '../simulation-native-video';

export type SimulationVideoProps = {
  videoUrl: string; expiresAt?: string | null; ownerKey: string; durationMs: number; startAtMs: number;
  active: boolean; busy: boolean; autoStart?: boolean; readOnly?: boolean; responseRecorded: boolean;
  heartbeatIntervalMs?: number; canSkip?: boolean; canAdvance?: boolean;
  fullScreen: boolean; onFullScreen: () => void;
  onStart: (actualMs: number) => Promise<boolean>;
  onRespond: (actualMs: number, eventId: string) => Promise<unknown>;
  onHeartbeat: (readActualMs: () => number) => Promise<unknown>;
  onEnded: (actualMs: number) => Promise<unknown>;
  onFault: (reason: 'VIDEO_ERROR' | 'NETWORK' | 'PAGE_EXIT' | 'PAUSED' | 'SEEK') => void;
  onSkip?: (actualMs: number) => Promise<unknown>; onAdvance?: () => Promise<unknown>;
  onReload?: () => void; startLabel?: string;
  onPrepare?: () => Promise<unknown>; onPracticeAgain?: () => Promise<unknown>; needsRecovery?: boolean; responseLocked?: boolean;
  onPrevious?: () => void; canPrevious?: boolean; previousIsExit?: boolean;
  onNextScenario?: () => void; canNextScenario?: boolean;
};
export function SimulationVideoPlayer(props: SimulationVideoProps) {
  const player = useVideoPlayer(null, value => {
    value.loop = false; value.playbackRate = 1; value.timeUpdateEventInterval = 0.1;
    value.staysActiveInBackground = false; value.showNowPlayingNotification = false;
  });
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; }, [props]);
  const focused = useRef(false), generation = useRef(0), begun = useRef(false), starting = useRef(false), ended = useRef(false), quarantine = useRef(true);
  const clock = useRef(new SimulationMediaClock());
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false), [time, setTime] = useState(0), [localBusy, setLocalBusy] = useState(false), [failure, setFailure] = useState<unknown>(null);
  const read = useCallback(() => actualMediaMs(player.currentTime), [player]);
  const stop = useCallback(() => { quarantine.current = true; begun.current = false; clock.current.clear(); player.pause(); setPlaying(false); }, [player]);
  const fault = useCallback((reason: Parameters<SimulationVideoProps['onFault']>[0]) => {
    if (!begun.current || callbacks.current.readOnly) return;
    stop(); callbacks.current.onFault(reason);
    setFailure(new Error('Video cần được tải lại để tiếp tục đúng vị trí đã lưu.'));
  }, [stop]);
  useFocusEffect(useCallback(() => {
    focused.current = true; generation.current++;
    return () => { focused.current = false; generation.current++; fault('PAGE_EXIT'); player.pause(); };
  }, [fault, player]));
  useEffect(() => {
    let live = true; quarantine.current = true; begun.current = false; ended.current = false; clock.current.clear(); player.pause();
    async function load() {
      try {
        const uri = requireMobileVideoUrl(props.videoUrl, props.expiresAt ?? undefined);
        await player.replaceAsync({ uri, contentType: 'progressive', useCaching: false });
        if (live) { setReady(player.status === 'readyToPlay'); setLocalBusy(false); setFailure(null); setTime(props.startAtMs); }
      } catch (error) { if (live) setFailure(error); }
    }
    void load();
    return () => { live = false; begun.current = false; quarantine.current = true; player.pause(); };
  }, [player, props.videoUrl, props.expiresAt, props.startAtMs, stop]);
  useEffect(() => {
    const subscriptions = [
      player.addListener('statusChange', value => {
        setReady(value.status === 'readyToPlay');
        if (value.status === 'error') { setFailure(new Error('Không thể tải video.')); fault('VIDEO_ERROR'); }
        else if (value.status === 'loading' && begun.current && !quarantine.current) fault('NETWORK');
      }),
      player.addListener('playingChange', value => {
        setPlaying(value.isPlaying);
        if (!value.isPlaying && begun.current && !ended.current && !quarantine.current && !callbacks.current.readOnly) {
          // Some native players emit playing=false before playToEnd. Only the actual end event can complete a scenario.
          const token = generation.current;
          setTimeout(() => { if (focused.current && token === generation.current && begun.current && !ended.current && !quarantine.current && !player.playing) fault('PAUSED'); }, 300);
        }
      }),
      player.addListener('timeUpdate', () => {
        if (!focused.current) return;
        let ms: number; try { ms = read(); } catch { fault('VIDEO_ERROR'); return; }
        setTime(ms);
        if (begun.current && player.playing && !callbacks.current.readOnly && !clock.current.observe(ms, Date.now())) fault('SEEK');
      }),
      player.addListener('playbackRateChange', value => { if (value.playbackRate !== 1 && !callbacks.current.readOnly) fault('SEEK'); }),
      player.addListener('playToEnd', () => {
        if (!focused.current || ended.current) return;
        ended.current = true; setPlaying(false);
        if (callbacks.current.readOnly || !begun.current) return;
        begun.current = false; quarantine.current = true;
        try { void callbacks.current.onEnded(read()).catch(setFailure); } catch (error) { setFailure(error); }
      }),
      AppState.addEventListener('change', value => { if (value !== 'active') { fault('PAGE_EXIT'); player.pause(); } }),
    ];
    return () => { subscriptions.forEach(subscription => subscription.remove()); };
  }, [player, read, fault]);
  const begin = useCallback(async () => {
    const current = callbacks.current;
    if (!focused.current || starting.current || !ready || current.busy) return;
    if (current.readOnly) { if (player.playing) player.pause(); else player.play(); return; }
    if (begun.current) return;
    const token = generation.current;
    starting.current = true; quarantine.current = true; setLocalBusy(true); setFailure(null); ended.current = false;
    try {
      requireMobileVideoUrl(current.videoUrl, current.expiresAt ?? undefined);
      positionNativeVideo(player, current.startAtMs);
      const deadline = Date.now() + 4000;
      while (Math.abs(read() - current.startAtMs) > 200) {
        if (!focused.current || token !== generation.current || Date.now() >= deadline) throw new Error('Chưa đặt được đúng vị trí phát.');
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }
      const approved = await current.onStart(read());
      if (!approved || !focused.current || token !== generation.current) return;
      begun.current = true; quarantine.current = false; clock.current.start(read(), Date.now()); player.play();
    } catch (error) { if (focused.current && token === generation.current) { stop(); setFailure(error); } }
    finally { starting.current = false; if (focused.current && token === generation.current) setLocalBusy(false); }
  }, [player, read, ready, stop]);
  useEffect(() => {
    if (props.autoStart && ready && !props.busy && !props.readOnly && !failure) void begin();
  }, [props.autoStart, props.busy, props.readOnly, ready, failure, begin]);
  useEffect(() => {
    if (!props.active && begun.current && !props.readOnly && !starting.current) stop();
  }, [props.active, props.readOnly, stop]);
  useEffect(() => {
    if (props.readOnly) return;
    const timer = setInterval(() => {
      if (!begun.current || !focused.current || !player.playing || player.status !== 'readyToPlay' || !callbacks.current.active) return;
      void callbacks.current.onHeartbeat(read).catch(error => { stop(); setFailure(error); callbacks.current.onFault('NETWORK'); });
    }, props.heartbeatIntervalMs ?? 3000);
    return () => clearInterval(timer);
  }, [player, read, stop, props.heartbeatIntervalMs, props.readOnly]);
  async function transition(action: 'skip' | 'next') {
    if (localBusy || props.busy) return;
    let ms: number; try { ms = read(); } catch (error) { setFailure(error); return; }
    stop(); setLocalBusy(true); setFailure(null);
    try { if (action === 'skip') await callbacks.current.onSkip?.(ms); else await callbacks.current.onAdvance?.(); }
    catch (error) { setFailure(error); } finally { if (focused.current) setLocalBusy(false); }
  }
  const disabled = props.busy || localBusy;
  const canReact = !disabled && !props.responseLocked && props.active && playing && !props.responseRecorded && !props.readOnly;
  const needsRecovery = !!failure || !!props.needsRecovery;
  const centerLabel = needsRecovery ? 'Tải lại video' : props.readOnly && props.onPracticeAgain ? 'Luyện lại tình huống' : props.readOnly ? (playing ? 'Tạm dừng xem lại' : 'Phát video xem lại') : props.active ? 'Video đang phát' : props.startLabel ?? 'Bắt đầu luyện tập';
  function center() {
    if (needsRecovery && props.onReload) { props.onReload(); return; }
    if (props.readOnly && props.onPracticeAgain) { void props.onPracticeAgain().catch(setFailure); return; }
    if (!props.readOnly && props.onPrepare && !props.active && !props.autoStart) { void props.onPrepare().catch(setFailure); return; }
    void begin();
  }
  return <View style={props.fullScreen ? { flex: 1 } : undefined}>
    <SimulationVideoFrame durationMs={props.durationMs} timeMs={time} fullScreen={props.fullScreen} onFullScreen={props.onFullScreen}
      loading={!ready && !failure} centerLabel={centerLabel} centerKind={needsRecovery || (props.readOnly && props.onPracticeAgain) ? 'retry' : props.readOnly && playing ? 'pause' : 'play'}
      centerDisabled={(!needsRecovery && !ready) || (!props.readOnly && props.active && !needsRecovery)} busy={disabled} onCenter={center}
      previous={props.onPrevious ? { label: props.previousIsExit ? 'Rời bài thi' : 'Tình huống trước', disabled: !props.canPrevious, onPress: props.onPrevious, exit: props.previousIsExit } : undefined}
      next={props.onNextScenario ? { label: 'Tình huống tiếp', disabled: !props.canNextScenario, onPress: props.onNextScenario } : props.onAdvance ? { label: 'Tình huống tiếp', disabled: !props.canAdvance, onPress: () => { void transition('next'); } } : undefined}
      onSkip={props.onSkip ? () => { void transition('skip'); } : undefined} canSkip={!props.responseLocked && !!props.canSkip && playing && time < 10000}
      readOnly={props.readOnly} responseRecorded={props.responseRecorded} canReact={canReact} onReact={() => {
        try { const ms = read(), event = newSimulationEventId(); void callbacks.current.onRespond(ms, event).catch(setFailure); } catch (error) { setFailure(error); }
      }}>
      <VideoView player={player} nativeControls={!!props.readOnly} fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} allowsVideoFrameAnalysis={false} contentFit="contain" style={{ width: '100%', height: '100%' }} />
    </SimulationVideoFrame>
    {failure ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 22, color: '#991B1B', marginTop: 10 }}>{simulationMessage(failure)}</Text> : null}
  </View>;
}
