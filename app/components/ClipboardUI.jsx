"use client";

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, UploadCloud } from 'lucide-react';
import { encrypt, encryptFile } from '../lib/crypto'
import TextNote from './TextNote';
import FileCard from './FileCard';
import Lightbox from './Lightbox';
import Modal from './Modal';
import ClipboardNavbar from './ClipboardNavbar';

export default function ClipboardUI({
  roomId,
  encryptionKey,
  clipboard,
  socket,
  connectionStatus,
  onLogout
}) {
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxBlendyId, setLightboxBlendyId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [densityMode, setDensityMode] = useState('comfortable');

  const isConnected = connectionStatus.socket === 'connected';
  const noteCount = clipboard.textNotes?.length || 0;
  const isCompact = densityMode === 'tight';

  const MAX_NOTES = 4;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedDensity = window.localStorage.getItem('clipboard-density-mode');
    if (storedDensity === 'tight' || storedDensity === 'comfortable') {
      setDensityMode(storedDensity);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('clipboard-density-mode', densityMode);
  }, [densityMode]);

  const toggleDensityMode = () => {
    setDensityMode((prev) => (prev === 'tight' ? 'comfortable' : 'tight'));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updateTouchMode = () => setIsTouchDevice(mediaQuery.matches);
    updateTouchMode();
    mediaQuery.addEventListener('change', updateTouchMode);
    return () => mediaQuery.removeEventListener('change', updateTouchMode);
  }, []);

  // Keyboard shortcuts and focus handling
  useEffect(() => {
    // Ensure the container can receive focus for keyboard events
    const container = document.getElementById('clipboard-container');
    if (container) {
      container.focus();
    }

    const handleKeyDown = async (e) => {
      // Prevent shortcuts when user is typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Ctrl/Cmd+V for pasting images
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (!isConnected) {
          toast.error("Cannot paste: not connected.");
          return;
        }
        if (clipboard.files.length >= 8) {
          toast.error('Maximum 8 files allowed.');
          return;
        }

        try {
          const clipboardItems = await navigator.clipboard.read();
          let hasImage = false;

          for (const clipboardItem of clipboardItems) {
            for (const type of clipboardItem.types) {
              if (type.startsWith('image/')) {
                const blob = await clipboardItem.getType(type);
                const file = new File([blob], `pasted-image-${Date.now()}.png`, { type });
                handleFileUpload(file);
                hasImage = true;
                return;
              }
            }
          }

          if (!hasImage) {
            toast.error('No image data in clipboard. Try taking a screenshot or copying an image directly from a webpage instead of a file from explorer.');
          }
        } catch (error) {
          console.error('Clipboard access error:', error);
          toast.error('Could not access clipboard. Make sure to allow clipboard permissions.');
        }
      }

      // Ctrl+C for copying selected image
      // if (e.ctrlKey && e.key === 'c' && selectedImageId) {
      //   e.preventDefault();
      //   const selectedImage = clipboard.files?.find(file => file.id === selectedImageId);
      //   if (selectedImage && selectedImage.type?.startsWith('image/')) {
      //     try {
      //       // Check if ClipboardItem and write are supported
      //       if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      //         const response = await fetch(selectedImage.url);
      //         const blob = await response.blob();
      //         await navigator.clipboard.write([
      //           new ClipboardItem({
      //             [blob.type]: blob
      //           })
      //         ]);
      //         toast.success('Image copied to clipboard!');
      //       } else {
      //         // Fallback: copy the image URL as text
      //         await navigator.clipboard.writeText(selectedImage.url);
      //         toast.success('Image URL copied to clipboard!');
      //       }
      //     } catch (error) {
      //       console.error('Copy error:', error);
      //       // Final fallback: try copying URL as text
      //       try {
      //         await navigator.clipboard.writeText(selectedImage.url);
      //         toast.success('Image URL copied to clipboard!');
      //       } catch (fallbackError) {
      //         toast.error('Copy not supported in this browser');
      //       }
      //     }
      //   }
      // }

      // Delete key for removing selected image
      if (e.key === 'Delete' && selectedImageId) {
        e.preventDefault();
        const selectedImage = clipboard.files?.find(file => file.id === selectedImageId);
        if (selectedImage && selectedImage.type?.startsWith('image/')) {
          handleDeleteImage(selectedImageId);
        }
      }
    };

    // Add event listener to document for global keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Focus the container when component mounts
    const focusContainer = () => {
      const container = document.getElementById('clipboard-container');
      if (container) {
        container.focus();
      }
    };

    // Focus immediately and on window focus
    focusContainer();
    window.addEventListener('focus', focusContainer);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('focus', focusContainer);
    };
  }, [isConnected, clipboard.files, selectedImageId, roomId]);

  // Handle image deletion
  const handleDeleteImage = async (imageId) => {
    if (!isConnected) {
      toast.error("Cannot delete: not connected.");
      return;
    }

    try {
      const response = await fetch(`/api/files?roomId=${roomId}&fileId=${imageId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }

      toast.success('Image deleted');
      setSelectedImageId(null);
    } catch (error) {
      toast.error(`Delete failed: ${error.message}`);
    }
  };

  const addTextNote = async () => {
    if (!isConnected) return toast.error("Cannot add note: not connected.");
    if (noteCount >= MAX_NOTES) {
      toast.error(`Maximum ${MAX_NOTES} text notes allowed.`);
      return;
    }
    try {
      // After 2nd note is added, add 2 notes at once
      const notesToAdd = noteCount >= 2 ? 2 : 1;
      const remainingSlots = MAX_NOTES - noteCount;
      const actualNotesToAdd = Math.min(notesToAdd, remainingSlots);

      for (let i = 0; i < actualNotesToAdd; i++) {
        const newNote = { id: (Date.now() + i).toString(), content: '' };
        const encryptedContent = await encrypt('', encryptionKey);
        newNote.content = encryptedContent;
        socket.emit('add-note', { roomId, note: newNote });
      }
    } catch (err) {
      toast.error("Could not create note.");
    }
  };

  const handleFileUpload = async (file) => {
    if (!isConnected) return toast.error("Cannot upload: not connected.");
    if (clipboard.files.length >= 8) {
      toast.error('Maximum 8 files allowed.');
      return;
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum allowed size is 100MB`);
      return;
    }

    const toastId = toast.loading(`Encrypting & uploading ${file.name}...`);
    try {
      // 1. Encrypt the filename (as before)
      const encryptedName = await encrypt(file.name, encryptionKey);

      // 2. ✅ Encrypt the file content
      const fileBuffer = await file.arrayBuffer();
      const encryptedBlob = await encryptFile(fileBuffer, encryptionKey);

      // 3. Create a new File object with the encrypted content
      const encryptedFile = new File([encryptedBlob], file.name, { type: 'application/octet-stream' });

      // 4. Upload the encrypted file
      const formData = new FormData();
      formData.append('file', encryptedFile); // Send the encrypted file
      formData.append('roomId', roomId);
      formData.append('encryptedName', encryptedName);
      // We still send the original file type for the icon display
      formData.append('originalType', file.type);

      const response = await fetch('/api/files', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      toast.success(`${file.name} uploaded!`, { id: toastId });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error.message}`, { id: toastId });
    }
  };

  const onDrop = (acceptedFiles) => {
    if (clipboard.files.length + acceptedFiles.length > 8) {
      toast.error('Maximum 8 files allowed.');
      return;
    }
    acceptedFiles.forEach(handleFileUpload);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, noClick: true, noKeyboard: true, disabled: !isConnected
  });

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Room URL copied to clipboard!');
  };

  const handleDeleteRoomConfirm = () => {
    if (socket && isConnected) {
      toast.loading('Deleting room...');
      socket.emit('delete-room', { roomId });
    } else {
      toast.error('Cannot delete room: not connected.');
    }
  };

  const handleImageClick = (decryptedUrl, imageId) => {
    setLightboxImage(decryptedUrl);
    setLightboxBlendyId(`preview-${imageId}`);
    setSelectedImageId(imageId);
  };

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isConnected ? 'Connected to clipboard room' : 'Disconnected from clipboard room'}
      </div>
      <ClipboardNavbar
        connectionStatus={connectionStatus}
        densityMode={densityMode}
        onToggleDensity={toggleDensityMode}
        onShare={handleShare}
        onDeleteRoom={() => setIsDeleteModalOpen(true)}
        onLogout={onLogout}
      />

      <div
        id="clipboard-container"
        {...getRootProps()}
        className="flex flex-col min-h-screen w-full outline-none px-3 sm:px-4 md:px-6 pt-[calc(var(--navbar-height)+0.5rem)]"
        tabIndex={0}
      >
        {isDragActive && !isTouchDevice && (
          <div className="fixed inset-0 flex items-center justify-center bg-opacity-70 backdrop-blur-md border-4 border-dashed border-cyan-400 rounded-3xl" style={{ zIndex: 10000 }}>
            <div className="text-center">
              <UploadCloud size={64} className="mx-auto text-cyan-300 animate-bounce" />
              <p className="mt-4 text-2xl font-bold text-white">Drop files to upload</p>
            </div>
          </div>
        )}

        <main className="main-container grow py-8 flex flex-col">
          <h2 className="text-xl font-semibold text-gray-200 mb-6 tracking-wider">Text Notes</h2>
          <div className={`grow flex ${noteCount >= 2 ? 'items-stretch' : 'flex-col'} ${isCompact ? 'gap-3 sm:gap-4' : 'gap-6'}`}>
            <div className={`grid grow ${isCompact ? 'gap-2 sm:gap-3' : 'gap-4 sm:gap-6'} ${noteCount >= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              <AnimatePresence>
                {clipboard.textNotes?.map((note) => (
                  <TextNote key={note.id} note={note} roomId={roomId} encryptionKey={encryptionKey} socket={socket} isConnected={isConnected} isCompact={isCompact} />
                ))}
              </AnimatePresence>
            </div>
            {noteCount < MAX_NOTES && (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`shrink-0 transition-all duration-500 ease-in-out ${noteCount >= 2 ? (isCompact ? 'w-16' : 'w-20') : 'w-full'} ${noteCount === 1 ? 'h-14' : ''}`}>
                <button onClick={addTextNote} disabled={!isConnected} className={`w-full h-full rounded-xl transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group backdrop-blur-[10px] border border-white/10 hover:bg-white/10 shadow-[0_0_5px_rgba(255,255,255,0.15)] hover:shadow-[0_0_10px_rgba(255,255,255,0.25)] ${isCompact ? 'p-2' : 'p-3'}`}>
                  <Plus size={isCompact ? 24 : 32} className="text-gray-500 group-hover:text-white transition-colors duration-200" />
                </button>
              </motion.div>
            )}
          </div>
        </main>

        <section className="main-container shrink-0 py-6 mt-auto" aria-label="Files">
          <h2 className="text-xl font-semibold text-gray-200 mb-6 tracking-wider">Files</h2>
          <div className={`flex items-stretch ${isCompact ? 'gap-2 sm:gap-3' : 'gap-3 sm:gap-4'} pb-safe overflow-x-auto px-1 pt-1 snap-x snap-mandatory`}>
            {clipboard.files?.map((file) => (
              <div
                key={file.id}
                className={`shrink-0 snap-start ${selectedImageId === file.id && file.type?.startsWith('image/') ? 'ring-2 ring-cyan-400 rounded-xl' : ''}`}
                onClick={() => file.type?.startsWith('image/') && setSelectedImageId(file.id)}
                role={file.type?.startsWith('image/') ? 'button' : undefined}
                tabIndex={file.type?.startsWith('image/') ? 0 : -1}
                aria-pressed={selectedImageId === file.id && file.type?.startsWith('image/') ? true : undefined}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && file.type?.startsWith('image/')) {
                    e.preventDefault();
                    setSelectedImageId(file.id);
                  }
                }}
              >
                <FileCard
                  file={file}
                  encryptionKey={encryptionKey}
                  roomId={roomId}
                  isConnected={isConnected}
                  densityMode={densityMode}
                  onImageClick={handleImageClick}
                />
              </div>
            ))}
            {clipboard.files?.length < 8 && (
              <label className={`cursor-pointer shrink-0 snap-start ${!isConnected ? 'cursor-not-allowed' : ''}`} aria-label="Upload files">
                <div className={`rounded-xl transition-all duration-300 ${isCompact ? 'p-3 w-32 sm:w-36 h-32 sm:h-36' : 'p-4 w-40 sm:w-44 h-36 sm:h-40'} flex items-center justify-center ${!isConnected ? 'opacity-50' : ''} group backdrop-blur-[10px] border border-white/10 hover:bg-white/10 shadow-[0_0_5px_rgba(255,255,255,0.15)] hover:shadow-[0_0_10px_rgba(255,255,255,0.25)]`}>
                  <Plus size={isCompact ? 22 : 28} className="text-gray-500 group-hover:text-white transition-colors duration-200" />
                </div>
                <input type="file" className="hidden" multiple onChange={(e) => Array.from(e.target.files).forEach(handleFileUpload)} disabled={!isConnected} />
              </label>
            )}
          </div>
        </section>

        <Lightbox
          imageUrl={lightboxImage}
          blendyId={lightboxBlendyId}
          onClose={() => {
            setLightboxImage(null);
            setLightboxBlendyId(null);
          }}
        />
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteRoomConfirm}
          title="Delete Entire Room"
          blendyId="delete-room-modal"
        >
          <p>Are you sure you want to permanently delete this room?</p>
          <p className="mt-2 font-bold text-red-400">All text notes and files will be lost forever. This action cannot be undone.</p>
        </Modal>
      </div>
    </>
  );
}