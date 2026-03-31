// server.js
require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
// Allow --host parameter to override hostname for mobile access
const hasHostFlag = process.argv.includes('--host');
const hostname = hasHostFlag ? "0.0.0.0" : (dev ? "localhost" : "0.0.0.0");
const port = process.env.PORT || 3000;
const getAllowedSocketOrigins = () => {
    if (!dev) {
        return process.env.SOCKET_IO_ORIGIN || false;
    }

    return [
        `http://localhost:${port}`,
        `http://127.0.0.1:${port}`,
        `http://192.168.11.11:${port}`,
    ];
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const MONGODB_URI = process.env.MONGODB_URI;
const DEFAULT_DB_NAME = process.env.MONGODB_DB_NAME || 'clipboard';
const isEnvFlagEnabled = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
const DB_NAME = MONGODB_URI
    ? (MONGODB_URI.split('/').pop() || DEFAULT_DB_NAME).split('?')[0]
    : DEFAULT_DB_NAME;
const isMongoEnabled = Boolean(MONGODB_URI);
const DEMO_BYPASS_ENABLED =
    !isMongoEnabled &&
    process.env.NODE_ENV !== 'production' &&
    isEnvFlagEnabled(process.env.ENABLE_DEMO_BYPASS);
const DEMO_ADMIN_PIN = process.env.DEMO_ADMIN_PIN || '123456';
const DEMO_ADMIN_HASH = createHash('sha256').update(DEMO_ADMIN_PIN).digest('hex');

if (!global.__DEMO_ROOMS) {
    global.__DEMO_ROOMS = new Map();
}

const getDemoRooms = () => global.__DEMO_ROOMS;

const clientPromise = isMongoEnabled
    ? new MongoClient(MONGODB_URI).connect()
    : Promise.resolve(null);

if (isMongoEnabled) {
    console.log(`MongoDB client configured. DB: ${DB_NAME}`);
} else {
    console.warn('MONGODB_URI is not set. Mongo-backed features are disabled.');
    if (DEMO_BYPASS_ENABLED) {
        console.warn(`Demo bypass enabled. Use 6-digit admin PIN: ${DEMO_ADMIN_PIN}`);
    }
}

const getDb = async () => {
    if (!isMongoEnabled) return null;
    const client = await clientPromise;
    return client.db(DB_NAME);
};

const getOrCreateDemoRoom = (roomId, expiration) => {
    const demoRooms = getDemoRooms();
    if (!demoRooms.has(roomId)) {
        const initialNote = {
            id: Date.now().toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        demoRooms.set(roomId, {
            _id: roomId,
            textNotes: [initialNote],
            files: [],
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + (Number(expiration) || 24 * 60 * 60 * 1000)),
        });
    }

    return demoRooms.get(roomId);
};

const deleteClipboardData = async (clipboard) => {
    // ... (this function remains the same)
    if (!clipboard) return;
    const db = await getDb();
    if (!db) return;

    if (clipboard.files && clipboard.files.length > 0) {
        for (const file of clipboard.files) {
            try {
                const filePath = path.join(process.cwd(), 'public', file.url);
                await fs.promises.unlink(filePath);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error(`Error deleting file ${file.url}:`, err);
                }
            }
        }
    }
    await db.collection('clipboards').deleteOne({ _id: clipboard._id });
    console.log(`Deleted clipboard for room ${clipboard._id}`);
};

// UPDATED: Cron job now checks for the 'expiresAt' field
const cleanupExpiredClipboards = async () => {
    console.log('Running cleanup job for expired clipboards...');
    try {
        const db = await getDb();
        if (!db) {
            console.log('Skipping cleanup: MongoDB is not configured.');
            return;
        }
        
        // Find documents where the expiresAt date is in the past
        const expiredClipboards = await db.collection('clipboards').find({
            expiresAt: { $lt: new Date() }
        }).toArray();

        if (expiredClipboards.length > 0) {
            console.log(`Found ${expiredClipboards.length} expired clipboards to delete.`);
            for (const clipboard of expiredClipboards) {
                await deleteClipboardData(clipboard);
            }
        } else {
            console.log('No expired clipboards found.');
        }
    } catch (error) {
        console.error('Error during clipboard cleanup job:', error);
    }

    if (DEMO_BYPASS_ENABLED) {
        const now = Date.now();
        const demoRooms = getDemoRooms();
        for (const [roomKey, room] of demoRooms.entries()) {
            const expiresAt = room?.expiresAt ? new Date(room.expiresAt).getTime() : Infinity;
            if (expiresAt < now) {
                demoRooms.delete(roomKey);
            }
        }
    }
};

// Run every hour
cron.schedule('0 * * * *', cleanupExpiredClipboards);

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        // ... (httpServer logic remains the same)
        try {
            const parsedUrl = parse(req.url, true);
            const { pathname } = parsedUrl;

            if (pathname.startsWith('/uploads/')) {
                const filePath = path.join(process.cwd(), 'public', pathname);
                fs.stat(filePath, (err, stats) => {
                    if (err || !stats.isFile()) {
                        res.statusCode = 404;
                        res.end('Not Found');
                        return;
                    }
                    res.setHeader('Content-Length', stats.size);
                    const readStream = fs.createReadStream(filePath);
                    readStream.pipe(res);
                });
            } else {
                await handle(req, res, parsedUrl);
            }
        } catch (err) {
            console.error('Error handling request', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    const io = new Server(httpServer, {
        cors: {
            origin: getAllowedSocketOrigins(),
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });
    global.io = io;

    io.on('connection', (socket) => {
        // ... ('test-connection' and 'delete-room' listeners remain the same)
        socket.on('test-connection', async () => {
            try {
                const db = await getDb();
                if (!db) {
                    socket.emit('connection-status', {
                        socket: 'connected',
                        mongodb: DEMO_BYPASS_ENABLED ? 'connected' : 'failed',
                        error: DEMO_BYPASS_ENABLED ? null : 'MONGODB_URI not configured',
                    });
                    return;
                }

                await db.command({ ping: 1 });
                socket.emit('connection-status', {
                    socket: 'connected',
                    mongodb: 'connected',
                });
            } catch (error) {
                socket.emit('connection-status', {
                    socket: 'connected',
                    mongodb: 'failed',
                    error: error.message,
                });
            }
        });

        socket.on('delete-room', async ({ roomId }) => {
            if (socket.roomId !== roomId) return;
            try {
                const db = await getDb();
                if (!db) {
                    if (!DEMO_BYPASS_ENABLED) {
                        socket.emit('error', { message: 'Database is not configured.' });
                        return;
                    }

                    getDemoRooms().delete(roomId);
                    io.to(roomId).emit('room-deleted');
                    return;
                }

                const clipboard = await db.collection('clipboards').findOne({ _id: roomId });

                if (clipboard) {
                    await deleteClipboardData(clipboard);
                    io.to(roomId).emit('room-deleted');
                }
            } catch (error) {
                socket.emit('error', { message: 'Failed to delete room.' });
            }
        });

        // REMOVED: updateRoomTimestamp function is no longer needed

        // UPDATED: 'authenticate-room' now accepts 'expiration'
        socket.on('authenticate-room', async ({ roomId, passwordHash, expiration }) => {
            try {
                const db = await getDb();
                if (!db) {
                    if (!DEMO_BYPASS_ENABLED) {
                        socket.emit('authentication-failed', { message: 'Server is not configured with a database. Set ENABLE_DEMO_BYPASS=true for local demo mode.' });
                        return;
                    }

                    if (passwordHash !== DEMO_ADMIN_HASH) {
                        socket.emit('authentication-failed', { message: 'Invalid demo admin password.' });
                        return;
                    }

                    const room = getOrCreateDemoRoom(roomId, expiration);
                    socket.join(roomId);
                    socket.roomId = roomId;
                    socket.emit('authentication-success');
                    socket.emit('room-data', { textNotes: room.textNotes || [], files: room.files || [] });
                    return;
                }

                let room = await db.collection('clipboards').findOne({ _id: roomId });

                if (!room) {
                    const initialNote = {
                        id: Date.now().toString(),
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };

                    // Calculate the expiration date
                    const expiresAt = new Date(Date.now() + expiration);

                    room = {
                        _id: roomId,
                        passwordHash,
                        textNotes: [initialNote],
                        files: [],
                        createdAt: new Date(),
                        expiresAt: expiresAt // Store the expiration date
                    };
                    await db.collection('clipboards').insertOne(room);
                    console.log(`New room created for ${roomId} with expiration at ${expiresAt.toLocaleString()}`);

                } else {
                    if (room.passwordHash && room.passwordHash !== passwordHash) {
                        socket.emit('authentication-failed', { message: 'Invalid password.' });
                        return;
                    }
                    // No need to update timestamp anymore
                }

                socket.join(roomId);
                socket.roomId = roomId;
                socket.emit('authentication-success');
                socket.emit('room-data', { textNotes: room.textNotes || [], files: room.files || [] });
            } catch (error) {
                console.error('Auth error:', error);
                socket.emit('authentication-failed', { message: 'Server error during authentication.' });
            }
        });

        // UPDATED: Note and file listeners now only update the content, not the room's lastUpdated time
        socket.on('add-note', async ({ roomId, note }) => {
            if (socket.roomId !== roomId) return;
            const db = await getDb();
            if (!db) {
                if (!DEMO_BYPASS_ENABLED) {
                    socket.emit('error', { message: 'Database is not configured.' });
                    return;
                }

                const room = getOrCreateDemoRoom(roomId);
                if (room.textNotes.length >= 4) {
                    socket.emit('error', { message: 'Maximum 4 text notes allowed.' });
                    return;
                }

                const noteWithTimestamp = { ...note, createdAt: new Date(), updatedAt: new Date() };
                room.textNotes.push(noteWithTimestamp);
                io.to(roomId).emit('note-added', noteWithTimestamp);
                return;
            }

            const room = await db.collection('clipboards').findOne({ _id: roomId }, { projection: { textNotes: 1 } });
            if (room && room.textNotes && room.textNotes.length >= 4) {
                socket.emit('error', { message: 'Maximum 4 text notes allowed.' });
                return;
            }

            const noteWithTimestamp = { ...note, createdAt: new Date(), updatedAt: new Date() };
            await db.collection('clipboards').updateOne({ _id: roomId }, { $push: { textNotes: noteWithTimestamp } });
            io.to(roomId).emit('note-added', noteWithTimestamp);
        });

        socket.on('update-note', async ({ roomId, noteId, encryptedContent }) => {
            if (socket.roomId !== roomId) return;
            const db = await getDb();
            if (!db) {
                if (!DEMO_BYPASS_ENABLED) {
                    socket.emit('error', { message: 'Database is not configured.' });
                    return;
                }

                const room = getOrCreateDemoRoom(roomId);
                room.textNotes = room.textNotes.map((note) => (
                    note.id === noteId
                        ? { ...note, content: encryptedContent, updatedAt: new Date() }
                        : note
                ));
                socket.to(roomId).emit('note-updated', { noteId, encryptedContent });
                return;
            }
            await db.collection('clipboards').updateOne(
                { _id: roomId, 'textNotes.id': noteId },
                { $set: { 'textNotes.$.content': encryptedContent, 'textNotes.$.updatedAt': new Date() } }
            );
            socket.to(roomId).emit('note-updated', { noteId, encryptedContent });
        });

        socket.on('delete-note', async ({ roomId, noteId }) => {
            if (socket.roomId !== roomId) return;
            const db = await getDb();
            if (!db) {
                if (!DEMO_BYPASS_ENABLED) {
                    socket.emit('error', { message: 'Database is not configured.' });
                    return;
                }

                const room = getOrCreateDemoRoom(roomId);
                room.textNotes = room.textNotes.filter((note) => note.id !== noteId);
                io.to(roomId).emit('note-deleted', noteId);
                return;
            }
            await db.collection('clipboards').updateOne({ _id: roomId }, { $pull: { textNotes: { id: noteId } } });
            io.to(roomId).emit('note-deleted', noteId);
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        // Run cleanup on startup
        cleanupExpiredClipboards();
    });
});
