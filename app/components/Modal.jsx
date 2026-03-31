// components/Modal.jsx
"use client";

import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { safeBlendyToggle, safeBlendyUntoggle } from '../lib/blendy';

export default function Modal({ isOpen, onClose, onConfirm, title, children, blendyId }) {
  const modalRef = useRef(null);
  const titleId = useId();

  const requestClose = () => {
    if (!blendyId) {
      onClose();
      return;
    }

    safeBlendyUntoggle(blendyId, () => {
      onClose();
    });
  };

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const previousFocus = document.activeElement;
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusables = Array.from(modal.querySelectorAll(selectors));
    const first = focusables[0] || modal;
    first.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }

      if (event.key !== 'Tab' || focusables.length === 0) return;

      const active = document.activeElement;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (event.shiftKey && active === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    if (blendyId) {
      requestAnimationFrame(() => {
        safeBlendyToggle(blendyId);
      });
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
    };
  }, [isOpen, blendyId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        // Backdrop
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm p-4" role="presentation" onClick={requestClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md bg-[#111] border border-zinc-800 rounded-xl shadow-xl"
            data-blendy-to={blendyId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            ref={modalRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-zinc-800">
              <h3 id={titleId} className="text-lg font-semibold text-zinc-200">{title}</h3>
              <button
                type="button"
                onClick={requestClose}
                className="text-zinc-500 hover:text-white transition-colors duration-200 p-2"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 text-zinc-400 text-sm leading-relaxed">
              {children}
            </div>
            
            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 px-6 py-4 bg-black/50 border-t border-zinc-800">
              <button
                type="button"
                onClick={requestClose}
                className="px-4 py-2 font-semibold text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  requestClose();
                }}
                className="px-4 py-2 font-semibold text-sm text-black bg-white hover:bg-zinc-200 rounded-md transition-colors duration-200"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}