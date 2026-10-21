import { PanResponder, type PanResponderGestureState } from 'react-native';

// Capture a deliberate horizontal drag, leaving taps and vertical scrolling
// to the answer cards and ScrollView. No answer/cursor API is called here.
export function createWrongQuestionSwipe(blocked: boolean, onMove: (direction: 1 | -1) => void) {
  let cancelled = false;
  const horizontal = (gesture: PanResponderGestureState, minimum: number) =>
    Number.isFinite(gesture.dx) && Number.isFinite(gesture.dy) &&
    Math.abs(gesture.dx) >= minimum && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, gesture) =>
      !blocked && gesture.numberActiveTouches === 1 && horizontal(gesture, 14),
    onPanResponderGrant: () => { cancelled = false; },
    onPanResponderMove: (_event, gesture) => { if (gesture.numberActiveTouches > 1) cancelled = true; },
    onPanResponderRelease: (_event, gesture) => {
      if (!blocked && !cancelled && gesture.numberActiveTouches <= 1 && horizontal(gesture, 48)) {
        // Requested direction: right = next, left = previous.
        onMove(gesture.dx > 0 ? 1 : -1);
      }
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => { cancelled = true; },
  }).panHandlers;
}
