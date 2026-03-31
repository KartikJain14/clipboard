// components/Lightbox.jsx
"use client";

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { safeBlendyToggle, safeBlendyUntoggle } from '../lib/blendy';

export default function Lightbox({ imageUrl, onClose, blendyId }) {
  const lightboxRef = useRef(null);

  const handleClose = () => {
    if (!blendyId) {
      onClose();
      return;
    }

    safeBlendyUntoggle(blendyId, () => {
      onClose();
    });
  };

  useEffect(() => {
    if (!imageUrl || !lightboxRef.current) return;

    const previousFocus = document.activeElement;
    lightboxRef.current.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    if (blendyId) {
      requestAnimationFrame(() => {
        safeBlendyToggle(blendyId);
      });
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
    };
  }, [imageUrl, blendyId]);

  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      {imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-lg"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          ref={lightboxRef}
          tabIndex={-1}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative"
            data-blendy-to={blendyId}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the image
          >
            <img
              src={imageUrl}
              alt="Full-size image preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={handleClose}
              className="absolute top-2 right-2 md:-top-4 md:-right-4 bg-gray-800 text-white p-3 rounded-full hover:bg-gray-700 transition-colors"
              aria-label="Close image preview"
            >
              <X size={24} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}