// components/TextNote.jsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';
import { encrypt, decrypt } from '../lib/crypto';
import { toast } from 'react-hot-toast';
import Modal from './Modal';
import CopyIcon from './CopyIcon';
import XIcon from './XIcon';

export default function TextNote({ note, roomId, encryptionKey, socket, isConnected, className, isCompact = false }) {
  const [decryptedContent, setDecryptedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const updateTimeout = useRef(null);

  useEffect(() => {
    const decryptContent = async () => {
      try {
        const text = await decrypt(note.content, encryptionKey);
        setDecryptedContent(text || '');
      } catch (error) {
        setDecryptedContent('Decryption failed');
      }
    };
    decryptContent();
  }, [note.content, encryptionKey]);

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setDecryptedContent(newContent);
    if (!isConnected) return;
    setIsSaving(true);
    if (updateTimeout.current) clearTimeout(updateTimeout.current);
    updateTimeout.current = setTimeout(async () => {
      try {
        const encryptedContent = await encrypt(newContent, encryptionKey);
        socket.emit('update-note', { roomId, noteId: note.id, encryptedContent });
      } catch (error) {
        toast.error('Failed to save note.');
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  const handleDeleteConfirm = () => {
    if (!isConnected) {
      toast.error("Cannot delete: not connected.");
      return;
    }
    socket.emit('delete-note', { roomId, noteId: note.id });
    toast.success('Note deleted!');
  };

  return (
    <>
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`relative group h-full ${className}`}
      >
        <div className={`bg-black border border-white rounded-xl ${isCompact ? 'p-2 sm:p-4' : 'p-3 sm:p-6'} h-full transition-all duration-300 flex flex-col shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]`}>
          <div className={`sticky top-0 z-10 bg-black/90 backdrop-blur-sm rounded-md flex justify-between items-center ${isCompact ? 'mb-1.5 sm:mb-3 py-1 px-1' : 'mb-2 sm:mb-5 py-1.5 px-1.5'} shrink-0`}>
            <div className={`flex items-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
              <div className={`${isCompact ? 'p-0.5' : 'p-1 sm:p-1.5'} text-gray-400`}>
                <CopyIcon size={18} />
              </div>
              {isSaving && <Loader size={16} className="text-blue-400 animate-spin" />}
              <span className="hidden sm:inline text-xs text-zinc-500">note</span>
            </div>
            <button
              type="button"
              data-blendy-from={`delete-note-${note.id}`}
              onClick={() => setIsModalOpen(true)}
              disabled={!isConnected}
              className={`text-gray-500 hover:text-red-400 transition-all duration-200 disabled:opacity-30 ${isCompact ? 'p-1.5' : 'p-2'} rounded-md hover:bg-white/5`}
              aria-label="Delete note"
            >
              <XIcon size={16} />
            </button>
          </div>
          <textarea
            value={decryptedContent}
            onChange={handleContentChange}
            disabled={!isConnected}
            className={`note-textarea w-full grow bg-transparent text-gray-200 resize-none focus:outline-none text-sm leading-relaxed placeholder-gray-400 disabled:opacity-50 ${isCompact ? 'px-1 py-1.5 sm:px-1.5 sm:py-2' : 'px-1 sm:px-2 py-2 sm:py-3'}`}
            placeholder={isConnected ? "Enter your note..." : "Offline - cannot edit"}
            aria-label="Text note editor"
            aria-busy={isSaving}
            autoCapitalize="sentences"
            spellCheck={true}
          />
        </div>
      </motion.div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Note"
        blendyId={`delete-note-${note.id}`}
      >
        <p>Are you sure you want to permanently delete this note?</p>
      </Modal>
    </>
  );
}