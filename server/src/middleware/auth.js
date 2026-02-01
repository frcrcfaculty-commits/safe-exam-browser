const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Authenticate JWT token
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Check if user is professor or admin
const requireProfessor = (req, res, next) => {
    if (req.user.role !== 'PROFESSOR' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Professor access required' });
    }
    next();
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Authenticate device for client routes
const authenticateDevice = async (req, res, next) => {
    try {
        const deviceId = req.headers['x-device-id'];
        if (!deviceId) {
            return res.status(401).json({ error: 'Device ID required' });
        }

        const device = await prisma.device.findUnique({
            where: { id: deviceId }
        });

        if (!device) {
            return res.status(401).json({ error: 'Device not registered' });
        }

        if (!device.approved) {
            return res.status(403).json({ error: 'Device not approved' });
        }

        // Update last seen
        await prisma.device.update({
            where: { id: deviceId },
            data: { lastSeen: new Date() }
        });

        req.device = device;
        next();
    } catch (error) {
        return res.status(500).json({ error: 'Device authentication failed' });
    }
};

// Authenticate session for exam operations
const authenticateSession = async (req, res, next) => {
    try {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            return res.status(401).json({ error: 'Session ID required' });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { exam: true }
        });

        if (!session) {
            return res.status(401).json({ error: 'Session not found' });
        }

        if (session.submittedAt) {
            return res.status(400).json({ error: 'Exam already submitted' });
        }

        req.session = session;
        next();
    } catch (error) {
        return res.status(500).json({ error: 'Session authentication failed' });
    }
};

module.exports = {
    authenticate,
    requireProfessor,
    requireAdmin,
    authenticateDevice,
    authenticateSession
};
