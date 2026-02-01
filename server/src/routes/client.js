const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateDevice, authenticateSession, authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/client/register - Register device
router.post('/register', async (req, res) => {
    try {
        const { hostname, macAddress } = req.body;

        if (!hostname) {
            return res.status(400).json({ error: 'Hostname required' });
        }

        // Check if already registered
        let device = await prisma.device.findUnique({ where: { hostname } });

        if (device) {
            return res.json({
                deviceId: device.id,
                status: device.approved ? 'approved' : 'pending_approval'
            });
        }

        // Create new device
        device = await prisma.device.create({
            data: { hostname, macAddress }
        });

        res.status(201).json({
            deviceId: device.id,
            status: 'pending_approval'
        });
    } catch (error) {
        console.error('Register device error:', error);
        res.status(500).json({ error: 'Failed to register device' });
    }
});

// GET /api/client/exams - Get available published exams
router.get('/exams', authenticateDevice, async (req, res) => {
    try {
        const exams = await prisma.exam.findMany({
            where: { status: 'PUBLISHED' },
            select: {
                id: true,
                examCode: true,
                title: true,
                description: true,
                durationMin: true,
                _count: { select: { questions: true } }
            }
        });

        res.json({
            exams: exams.map(e => ({
                id: e.id,
                examCode: e.examCode,
                title: e.title,
                description: e.description,
                durationMin: e.durationMin,
                questionCount: e._count.questions
            }))
        });
    } catch (error) {
        console.error('Get exams error:', error);
        res.status(500).json({ error: 'Failed to get exams' });
    }
});

// GET /api/client/exam-by-code/:code - Get exam by code
router.get('/exam-by-code/:code', async (req, res) => {
    try {
        const exam = await prisma.exam.findUnique({
            where: { examCode: req.params.code.toUpperCase() },
            select: {
                id: true,
                examCode: true,
                title: true,
                description: true,
                durationMin: true,
                status: true,
                _count: { select: { questions: true } }
            }
        });

        if (!exam) {
            return res.status(404).json({ error: 'Invalid exam code' });
        }

        if (exam.status !== 'PUBLISHED') {
            return res.status(400).json({ error: 'This exam is not yet published. Please contact your professor.' });
        }

        res.json({
            id: exam.id,
            examCode: exam.examCode,
            title: exam.title,
            description: exam.description,
            durationMin: exam.durationMin,
            questionCount: exam._count.questions
        });
    } catch (error) {
        console.error('Get exam by code error:', error);
        res.status(500).json({ error: 'Failed to get exam' });
    }
});

// POST /api/client/start - Start exam (supports both device and user auth)
router.post('/start', async (req, res) => {
    try {
        const { rollNumber, examId, examCode } = req.body;

        if (!rollNumber) {
            return res.status(400).json({ error: 'Roll number required' });
        }

        if (!examId && !examCode) {
            return res.status(400).json({ error: 'Exam ID or exam code required' });
        }

        // Find exam by ID or code
        let exam;
        if (examCode) {
            exam = await prisma.exam.findUnique({
                where: { examCode: examCode.toUpperCase() }
            });
        } else {
            exam = await prisma.exam.findUnique({ where: { id: examId } });
        }

        if (!exam) {
            return res.status(404).json({ error: 'Invalid exam code. Please check and try again.' });
        }

        if (exam.status !== 'PUBLISHED') {
            return res.status(400).json({ error: 'This exam is not yet published. Please contact your professor.' });
        }

        // Check device header (optional for student login)
        const deviceId = req.headers['x-device-id'];
        let device = null;
        if (deviceId) {
            device = await prisma.device.findUnique({ where: { id: deviceId } });
        }

        // Check user token (for student login)
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const jwt = require('jsonwebtoken');
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId;
            } catch (e) {
                // Token invalid, continue without user
            }
        }

        // Check for existing session
        let session = await prisma.session.findUnique({
            where: { examId_rollNumber: { examId: exam.id, rollNumber } }
        });

        if (session) {
            if (session.submittedAt) {
                return res.status(400).json({ error: 'Exam already submitted' });
            }
            // Resume existing session
            return res.json({
                sessionId: session.id,
                examCode: exam.examCode,
                durationMin: exam.durationMin,
                startedAt: session.startedAt,
                resuming: true
            });
        }

        // Create new session
        session = await prisma.session.create({
            data: {
                examId: exam.id,
                deviceId: device?.id || null,
                userId: userId,
                rollNumber,
                flagsJson: '[]'
            }
        });

        // Log exam start event
        await prisma.eventLog.create({
            data: {
                sessionId: session.id,
                eventType: 'exam_started',
                detailsJson: JSON.stringify({ deviceHostname: device?.hostname || 'web', userId })
            }
        });

        res.json({
            sessionId: session.id,
            examCode: exam.examCode,
            durationMin: exam.durationMin,
            startedAt: session.startedAt,
            resuming: false
        });
    } catch (error) {
        console.error('Start exam error:', error);
        res.status(500).json({ error: 'Failed to start exam' });
    }
});

// GET /api/client/exam - Get exam questions
router.get('/exam', authenticateSession, async (req, res) => {
    try {
        const questions = await prisma.question.findMany({
            where: { examId: req.session.examId },
            orderBy: { order: 'asc' },
            select: {
                id: true,
                text: true,
                optionsJson: true,
                order: true
                // NOTE: correctIdx is NOT sent to client
            }
        });

        // Get existing responses
        const responses = await prisma.response.findMany({
            where: { sessionId: req.session.id }
        });

        const responseMap = {};
        responses.forEach(r => {
            responseMap[r.questionId] = r.selectedIdx;
        });

        res.json({
            examTitle: req.session.exam.title,
            examCode: req.session.exam.examCode,
            durationMin: req.session.exam.durationMin,
            startedAt: req.session.startedAt,
            questions: questions.map(q => ({
                id: q.id,
                text: q.text,
                options: JSON.parse(q.optionsJson),
                order: q.order,
                selectedIdx: responseMap[q.id] ?? null
            }))
        });
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ error: 'Failed to get exam' });
    }
});

// POST /api/client/save - Save response (auto-save)
router.post('/save', authenticateSession, async (req, res) => {
    try {
        const { questionId, selectedIdx } = req.body;

        await prisma.response.upsert({
            where: {
                sessionId_questionId: {
                    sessionId: req.session.id,
                    questionId
                }
            },
            update: { selectedIdx, timestamp: new Date() },
            create: {
                sessionId: req.session.id,
                questionId,
                selectedIdx
            }
        });

        res.json({ saved: true });
    } catch (error) {
        console.error('Save response error:', error);
        res.status(500).json({ error: 'Failed to save response' });
    }
});

// POST /api/client/submit - Submit exam
router.post('/submit', authenticateSession, async (req, res) => {
    try {
        const { responses } = req.body;

        // Save all responses
        if (Array.isArray(responses)) {
            for (const r of responses) {
                await prisma.response.upsert({
                    where: {
                        sessionId_questionId: {
                            sessionId: req.session.id,
                            questionId: r.questionId
                        }
                    },
                    update: { selectedIdx: r.selectedIdx },
                    create: {
                        sessionId: req.session.id,
                        questionId: r.questionId,
                        selectedIdx: r.selectedIdx
                    }
                });
            }
        }

        // Get questions with correct answers for grading
        const questions = await prisma.question.findMany({
            where: { examId: req.session.examId }
        });

        // Get all responses
        const savedResponses = await prisma.response.findMany({
            where: { sessionId: req.session.id }
        });

        // Grade exam
        let score = 0;
        const answerKey = {};
        questions.forEach(q => { answerKey[q.id] = q.correctIdx; });

        savedResponses.forEach(r => {
            if (r.selectedIdx === answerKey[r.questionId]) {
                score++;
            }
        });

        const total = questions.length;

        // Update session
        await prisma.session.update({
            where: { id: req.session.id },
            data: {
                submittedAt: new Date(),
                score,
                total
            }
        });

        // Log submit event
        await prisma.eventLog.create({
            data: {
                sessionId: req.session.id,
                eventType: 'exam_submitted',
                detailsJson: JSON.stringify({ score, total })
            }
        });

        res.json({
            score,
            total,
            percentage: total > 0 ? ((score / total) * 100).toFixed(1) : 0,
            submittedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Submit error:', error);
        res.status(500).json({ error: 'Failed to submit exam' });
    }
});

// POST /api/client/heartbeat - Heartbeat with events
router.post('/heartbeat', authenticateSession, async (req, res) => {
    try {
        const { events } = req.body;

        // Log events
        if (Array.isArray(events) && events.length > 0) {
            for (const e of events) {
                await prisma.eventLog.create({
                    data: {
                        sessionId: req.session.id,
                        eventType: e.type,
                        detailsJson: e.details ? JSON.stringify(e.details) : null,
                        timestamp: e.timestamp ? new Date(e.timestamp) : new Date()
                    }
                });
            }

            // Check for flaggable events
            const flaggableEvents = ['focus_lost', 'blocked_shortcut', 'display_changed'];
            const newFlags = events.filter(e => flaggableEvents.includes(e.type)).map(e => e.type);

            if (newFlags.length > 0) {
                const session = await prisma.session.findUnique({ where: { id: req.session.id } });
                const existingFlags = JSON.parse(session.flagsJson || '[]');
                await prisma.session.update({
                    where: { id: req.session.id },
                    data: { flagsJson: JSON.stringify([...existingFlags, ...newFlags]) }
                });
            }
        }

        // Check if exam time expired
        const endTime = new Date(req.session.startedAt.getTime() + req.session.exam.durationMin * 60000);
        const expired = new Date() > endTime;

        res.json({
            continue: !expired && !req.session.submittedAt,
            remainingMs: Math.max(0, endTime - new Date())
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Heartbeat failed' });
    }
});

module.exports = router;
