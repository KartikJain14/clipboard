"use client";

import { createBlendy } from 'blendy';

let blendyInstance;
const SNAPPY_UNTOGGLE_MS = 260;

export function getBlendy() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!blendyInstance) {
    blendyInstance = createBlendy({ animation: 'dynamic' });
  }

  return blendyInstance;
}

const hasSourceAndTarget = (id) => {
  if (typeof document === 'undefined') return false;
  const source = document.querySelector(`[data-blendy-from="${id}"]`);
  const target = document.querySelector(`[data-blendy-to="${id}"]`);
  return Boolean(source && target);
};

export function safeBlendyToggle(id) {
  if (!id) return false;
  const blendy = getBlendy();
  if (!blendy) return false;

  try {
    blendy.update();
    if (!hasSourceAndTarget(id)) return false;
    blendy.toggle(id);
    return true;
  } catch (error) {
    console.warn(`Blendy toggle skipped for ${id}:`, error);
    return false;
  }
}

export function safeBlendyUntoggle(id, onDone) {
  if (!id) {
    if (onDone) onDone();
    return false;
  }

  const blendy = getBlendy();
  if (!blendy) {
    if (onDone) onDone();
    return false;
  }

  try {
    blendy.update();
    if (!hasSourceAndTarget(id)) {
      if (onDone) onDone();
      return false;
    }

    let didFinish = false;
    const done = () => {
      if (didFinish) return;
      didFinish = true;
      if (onDone) onDone();
    };

    const timeoutId = window.setTimeout(done, SNAPPY_UNTOGGLE_MS);

    blendy.untoggle(id, () => {
      window.clearTimeout(timeoutId);
      done();
    });
    return true;
  } catch (error) {
    console.warn(`Blendy untoggle skipped for ${id}:`, error);
    if (onDone) onDone();
    return false;
  }
}
