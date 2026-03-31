"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import ShieldCheckIcon from './ShieldCheckIcon';
import ClockIcon from './ClockIcon';
import DownChevron from './DownChevron';
import { AppleHelloEnglishEffect } from './apple-hello-effect';

const LIFETIME_OPTIONS = [
  { label: '3 Hours', value: 3 * 60 * 60 * 1000 },
  { label: '1 Day', value: 24 * 60 * 60 * 1000 },
  { label: '7 Days', value: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 Days', value: 30 * 24 * 60 * 60 * 1000 },
];

const BOOT_TIMINGS = {
  helloSpeed: 2.4,
  helloDurationMs: Math.round(((0.7 + 2.8) / 2.4) * 1000),
  helloRainStartRatio: 0.56,
  helloPhaseFade: 0.14,
  rainPhaseFade: 0.08,
  rainHoldMs: 180,
  formPhaseEnter: 0.24,
};

export default function PasswordScreen({ onSubmit, isLoading = false, loginBlendyId = 'room-auth-transition', showIntro = true }) {
  const [password, setPassword] = useState('');
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isLifetimeOpen, setIsLifetimeOpen] = useState(false);
  const [bootPhase, setBootPhase] = useState(showIntro ? 'hello' : 'form');
  // State for the selected expiration time, default to 1 day
  const [expiration, setExpiration] = useState(24 * 60 * 60 * 1000); // 1 day in milliseconds
  const lifetimeDropdownRef = useRef(null);
  const rainTimerRef = useRef(null);
  const helloRainStartTimerRef = useRef(null);

  const selectedLifetime = LIFETIME_OPTIONS.find((option) => option.value === expiration) || LIFETIME_OPTIONS[1];

  useEffect(() => {
    setHasHydrated(true);

    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !showIntro) {
      document.body.classList.add('rain-ready');
      setBootPhase('form');
      return;
    }

    document.body.classList.remove('rain-ready');
    helloRainStartTimerRef.current = window.setTimeout(() => {
      document.body.classList.add('rain-ready');
    }, Math.round(BOOT_TIMINGS.helloDurationMs * BOOT_TIMINGS.helloRainStartRatio));

    return () => {
      if (rainTimerRef.current) {
        window.clearTimeout(rainTimerRef.current);
      }
      if (helloRainStartTimerRef.current) {
        window.clearTimeout(helloRainStartTimerRef.current);
      }
    };
  }, [showIntro]);

  const isSubmitDisabled = hasHydrated
    ? (password.length < 6 || Boolean(isLoading))
    : false;

  const startRainThenForm = () => {
    if (bootPhase !== 'hello') return;
    setBootPhase('rain');
    document.body.classList.add('rain-ready');
    rainTimerRef.current = window.setTimeout(() => {
      setBootPhase('form');
    }, BOOT_TIMINGS.rainHoldMs);
  };

  const closeLifetimeDropdown = () => {
    setIsLifetimeOpen(false);
  };

  const openLifetimeDropdown = () => {
    setIsLifetimeOpen(true);
  };

  const toggleLifetimeDropdown = () => {
    if (isLifetimeOpen) {
      closeLifetimeDropdown();
    } else {
      openLifetimeDropdown();
    }
  };

  const selectLifetime = (value) => {
    setExpiration(value);
    closeLifetimeDropdown();
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!isLifetimeOpen) return;
      if (lifetimeDropdownRef.current && !lifetimeDropdownRef.current.contains(event.target)) {
        closeLifetimeDropdown();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape' && isLifetimeOpen) {
        closeLifetimeDropdown();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isLifetimeOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Minimum 6 character validation
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    if (password && !isLoading) {
      // Pass both password and expiration to the parent
      onSubmit(password, expiration);
    }
  };

  return (
    <div className="h-dvh w-full overflow-hidden flex items-center justify-center px-4 py-0 sm:py-4">
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {bootPhase === 'hello' && (
            <motion.div
              key="hello-intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: BOOT_TIMINGS.helloPhaseFade }}
              className="min-h-[280px] flex items-center justify-center"
            >
              <AppleHelloEnglishEffect
                speed={BOOT_TIMINGS.helloSpeed}
                className="h-24 w-auto text-zinc-100"
                onAnimationComplete={startRainThenForm}
              />
            </motion.div>
          )}

          {bootPhase === 'rain' && (
            <motion.div
              key="rain-wait"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: BOOT_TIMINGS.rainPhaseFade }}
              className="min-h-[280px]"
            />
          )}

          {bootPhase === 'form' && (
            <motion.div
              key="auth-form"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: BOOT_TIMINGS.formPhaseEnter, ease: 'easeOut' }}
              className="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-lg shadow-xl"
            >
              <div className="p-6 sm:p-8 text-white">
                <div className="text-center mb-8">
                  <ShieldCheckIcon size={48} className="mx-auto text-zinc-500 mb-4" />
                  <h2 className="text-2xl font-semibold text-zinc-200 mb-2">Live Clipboard</h2>
                  <p className="text-zinc-500 text-sm">
                    Enter a password to create or join a room.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="room-password" className="block text-xs text-zinc-400 mb-2">
                      Password
                    </label>
                    <input
                      id="room-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md px-4 py-3 text-sm bg-zinc-900/50 text-white placeholder-zinc-600 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-300 border border-zinc-700 focus:border-zinc-500"
                      placeholder="Enter Password (min. 6 characters)"
                    />
                  </div>

                  <div>
                    <label htmlFor="expiration" className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                      <ClockIcon size={14} className="text-zinc-400" />
                      <span>Room Lifetime</span>
                    </label>
                    <div ref={lifetimeDropdownRef} className="relative">
                      <button
                        id="expiration"
                        type="button"
                        className="w-full rounded-md px-4 py-3 text-sm bg-zinc-900/50 text-white focus:ring-1 focus:ring-white/20 focus:outline-none transition-all duration-300 border border-zinc-700 focus:border-zinc-500 flex items-center justify-between"
                        aria-haspopup="listbox"
                        aria-expanded={isLifetimeOpen}
                        onClick={toggleLifetimeDropdown}
                      >
                        <span>{selectedLifetime.label}</span>
                        <DownChevron
                          size={18}
                          className={`text-zinc-400 transition-transform duration-300 ${isLifetimeOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      <AnimatePresence>
                        {isLifetimeOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.16, ease: 'easeOut' }}
                            className="absolute left-0 right-0 mt-2 rounded-md border border-white/20 bg-black/95 backdrop-blur-xl shadow-xl z-50 overflow-hidden"
                            role="listbox"
                            aria-label="Room lifetime"
                          >
                            <div>
                              {LIFETIME_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  role="option"
                                  aria-selected={expiration === option.value}
                                  onClick={() => selectLifetime(option.value)}
                                  className={`w-full text-left px-4 py-3 text-sm transition-colors duration-200 border-b border-white/10 last:border-b-0 ${
                                    expiration === option.value
                                      ? 'bg-white/15 text-white'
                                      : 'text-zinc-200 hover:bg-white/10'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <button
                    type="submit"
                    data-blendy-from={loginBlendyId}
                    className="w-full group rounded-md py-3 px-4 bg-white text-black font-semibold text-sm transition-all duration-300 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                    disabled={isSubmitDisabled}
                    aria-disabled={password.length < 6 || Boolean(isLoading)}
                  >
                    <span>{isLoading ? 'Unlocking...' : 'Unlock'}</span>
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
