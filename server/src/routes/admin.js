const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/admin/devices - List all devices
router.get('/devices', authenticate, requireAdmin, async (req, res) => {
    try {
        const devices = await prisma.device.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.json({ devices });
    } catch (error) {
        console.error('List devices error:', error);
        res.status(500).json({ error: 'Failed to list devices' });
    }
});

// POST /api/admin/devices/:id/approve - Approve device
router.post('/devices/:id/approve', authenticate, requireAdmin, async (req, res) => {
    try {
        const device = await prisma.device.update({
            where: { id: req.params.id },
            data: { approved: true }
        });

        res.json({ id: device.id, approved: device.approved });
    } catch (error) {
        console.error('Approve device error:', error);
        res.status(500).json({ error: 'Failed to approve device' });
    }
});

// DELETE /api/admin/devices/:id - Remove device
router.delete('/devices/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        await prisma.device.delete({
            where: { id: req.params.id }
        });

        res.json({ deleted: true });
    } catch (error) {
        console.error('Delete device error:', error);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

// GET /api/admin/users - List all users
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                department: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ users });
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
    try {
        const [examCount, userCount, deviceCount, sessionCount] = await Promise.all([
            prisma.exam.count(),
            prisma.user.count(),
            prisma.device.count({ where: { approved: true } }),
            prisma.session.count({ where: { submittedAt: { not: null } } })
        ]);

        res.json({
            exams: examCount,
            users: userCount,
            devices: deviceCount,
            completedSessions: sessionCount
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// GET /api/admin/events - Recent security events
router.get('/events', authenticate, requireAdmin, async (req, res) => {
    try {
        const events = await prisma.eventLog.findMany({
            where: {
                eventType: { in: ['focus_lost', 'blocked_shortcut', 'display_changed'] }
            },
            include: {
                session: { select: { rollNumber: true } }
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        res.json({ events });
    } catch (error) {
        console.error('Events error:', error);
        res.status(500).json({ error: 'Failed to get events' });
    }
});

module.exports = router;
