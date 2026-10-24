type Swipe = { dx: number; dy: number; vy: number; numberActiveTouches: number };

export function canDragSheet(gesture: Swipe, scrollOffset: number) {
  return gesture.numberActiveTouches === 1 && scrollOffset <= 0 &&
    gesture.dy > 10 && gesture.dy > Math.abs(gesture.dx) * 1.4;
}

export function shouldDismissSheet(gesture: Pick<Swipe, 'dx' | 'dy' | 'vy'>) {
  return gesture.dy > Math.abs(gesture.dx) * 1.4 &&
    (gesture.dy >= 72 || (gesture.dy >= 24 && gesture.vy >= 0.7));
}
