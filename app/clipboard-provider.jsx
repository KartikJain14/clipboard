"use client";

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Toaster, toast } from 'react-hot-toast';
import { deriveKey, getRoomId, hashPassword } from './lib/crypto';
import PasswordScreen from './components/PasswordScreen';
import ClipboardUI from './components/ClipboardUI';
import { safeBlendyToggle } from './lib/blendy';

const TOAST_IDS = {
  connect: 'socket-connected',
  disconnect: 'socket-disconnected',
  dbFailed: 'db-failed',
  authFailed: 'auth-failed',
  authLoading: 'auth-loading',
  authSuccess: 'auth-success',
};

export default function ClipboardProvider() {
  const AUTH_BLENDY_ID = 'room-auth-transition';
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [clipboard, setClipboard] = useState({ textNotes: [], files: [] });
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [showBootIntro, setShowBootIntro] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({
    socket: 'disconnected',
    mongodb: 'unknown'
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const socketConnection = io();

    socketConnection.on('connect', () => {
      setSocket(socketConnection);
      toast.dismiss(TOAST_IDS.disconnect);
      toast.success('Connected!', { id: TOAST_IDS.connect });
      setConnectionStatus(prev => ({ ...prev, socket: 'connected' }));
      socketConnection.emit('test-connection');
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason !== 'io client disconnect') {
        toast.error('Connection lost. Reconnecting...', { id: TOAST_IDS.disconnect });
      }
      setSocket(null);
      setIsAuthenticated(false);
      setConnectionStatus({ socket: 'disconnected', mongodb: 'unknown' });
    });

    socketConnection.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socketConnection.on('connection-status', (status) => {
      setConnectionStatus(status);
      if (status.mongodb === 'failed') {
        toast.error('Database connection failed.', { id: TOAST_IDS.dbFailed });
      }
    });

    socketConnection.on('authentication-success', () => {
      toast.dismiss(TOAST_IDS.authLoading);
      toast.dismiss(TOAST_IDS.authFailed);
      toast.success('Room unlocked!', { id: TOAST_IDS.authSuccess });
      setIsAuthenticated(true);
      setIsDataLoading(false);

      requestAnimationFrame(() => {
        safeBlendyToggle(AUTH_BLENDY_ID);
      });
    });
    
    socketConnection.on('room-deleted', () => {
      toast.error('This room has been permanently deleted.', {
        duration: 5000,
      });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    });

    socketConnection.on('authentication-failed', (error) => {
      toast.dismiss(TOAST_IDS.authLoading);
      toast.error(`Authentication failed: ${error.message}`, { id: TOAST_IDS.authFailed });
      setIsDataLoading(false);
      setRoomId(null);
      setEncryptionKey(null);
      setIsAuthenticated(false);
    });

    socketConnection.on('room-data', (data) => {
      setClipboard({
        textNotes: data.textNotes || [],
        files: data.files || []
      });
    });

    socketConnection.on('note-added', (newNote) => {
      setClipboard(prev => ({ ...prev, textNotes: [...prev.textNotes, newNote] }));
    });
    socketConnection.on('note-updated', ({ noteId, encryptedContent }) => {
      setClipboard(prev => ({
        ...prev,
        textNotes: prev.textNotes.map(n => n.id === noteId ? { ...n, content: encryptedContent, updatedAt: new Date() } : n)
      }));
    });
    socketConnection.on('note-deleted', (noteId) => {
      setClipboard(prev => ({ ...prev, textNotes: prev.textNotes.filter(n => n.id !== noteId) }));
    });
    socketConnection.on('file-added', (newFile) => {
      setClipboard(prev => ({ ...prev, files: [...prev.files, newFile] }));
    });
    socketConnection.on('file-deleted', (fileId) => {
      setClipboard(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }));
    });


    return () => {
      socketConnection.disconnect();
    };
  }, []);

  const handlePasswordSubmit = async (password, expiration) => {
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    setIsDataLoading(true);
    const loadingToast = toast.loading('Encrypting and joining room...', { id: TOAST_IDS.authLoading });

    try {
      const derivedRoomId = await getRoomId(password);
      const key = await deriveKey(password, derivedRoomId);
      const passwordHash = await hashPassword(password);

      setRoomId(derivedRoomId);
      setEncryptionKey(key);

      if (socket && socket.connected) {
        socket.emit('authenticate-room', { 
          roomId: derivedRoomId, 
          passwordHash,
          expiration
        });
      } else {
        toast.error('Connection not ready. Please wait.', { id: loadingToast });
        setIsDataLoading(false);
        return;
      }
    } catch (error) {
      toast.error("Could not process password.", { id: loadingToast });
      setIsDataLoading(false);
    }
  };

  const handleLogout = () => {
    setShowBootIntro(false);
    setIsAuthenticated(false);
    setRoomId(null);
    setEncryptionKey(null);
    setClipboard({ textNotes: [], files: [] });
    setIsDataLoading(false);
  };

  return (
    <>
      <Toaster
        position="bottom-center"
        containerStyle={{
          bottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
      {!isAuthenticated ? (
        <PasswordScreen onSubmit={handlePasswordSubmit} isLoading={isDataLoading} loginBlendyId={AUTH_BLENDY_ID} showIntro={showBootIntro} />
      ) : (
        <div data-blendy-to={AUTH_BLENDY_ID}>
          <div>
            <ClipboardUI
              roomId={roomId}
              encryptionKey={encryptionKey}
              clipboard={clipboard}
              socket={socket}
              connectionStatus={connectionStatus}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}
    </>
  );
}
