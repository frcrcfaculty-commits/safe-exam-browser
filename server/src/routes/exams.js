const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireProfessor } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Helper to generate unique 6-character exam code
function generateExamCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Helper to parse JSON arrays stored as strings
const parseOptions = (q) => ({
    ...q,
    options: typeof q.optionsJson === 'string' ? JSON.parse(q.optionsJson) : q.optionsJson
});

// GET /api/exams - List professor's exams
router.get('/', authenticate, requireProfessor, async (req, res) => {
    try {
        const exams = await prisma.exam.findMany({
            where: { professorId: req.user.id },
            include: { _count: { select: { questions: true, sessions: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            exams: exams.map(e => ({
                id: e.id,
                examCode: e.examCode,
                title: e.title,
                status: e.status,
                durationMin: e.durationMin,
                questionCount: e._count.questions,
                sessionCount: e._count.sessions,
                createdAt: e.createdAt
            }))
        });
    } catch (error) {
        console.error('List exams error:', error);
        res.status(500).json({ error: 'Failed to list exams' });
    }
});

// POST /api/exams - Create exam with unique code
router.post('/', authenticate, requireProfessor, async (req, res) => {
    try {
        const { title, description, durationMin, template } = req.body;

        if (!title || !durationMin) {
            return res.status(400).json({ error: 'Title and duration required' });
        }

        // Generate unique exam code
        let examCode;
        let attempts = 0;
        while (attempts < 10) {
            examCode = generateExamCode();
            const existing = await prisma.exam.findUnique({ where: { examCode } });
            if (!existing) break;
            attempts++;
        }
        if (attempts >= 10) {
            return res.status(500).json({ error: 'Failed to generate unique exam code' });
        }

        const exam = await prisma.exam.create({
            data: {
                examCode,
                title,
                description,
                durationMin: parseInt(durationMin),
                template: template || 'mcq',
                professorId: req.user.id
            }
        });

        res.status(201).json({
            id: exam.id,
            examCode: exam.examCode,
            title: exam.title,
            status: exam.status,
            durationMin: exam.durationMin
        });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ error: 'Failed to create exam' });
    }
});

// GET /api/exams/:id - Get exam details
router.get('/:id', authenticate, requireProfessor, async (req, res) => {
    try {
        const exam = await prisma.exam.findFirst({
            where: { id: req.params.id, professorId: req.user.id },
            include: { questions: { orderBy: { order: 'asc' } } }
        });

        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        exam.questions = exam.questions.map(parseOptions);
        res.json({ exam });
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ error: 'Failed to get exam' });
    }
});

// POST /api/exams/:id/questions - Add questions
router.post('/:id/questions', authenticate, requireProfessor, async (req, res) => {
    try {
        const { questions } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Questions array required' });
        }

        const exam = await prisma.exam.findFirst({
            where: { id: req.params.id, professorId: req.user.id }
        });

        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        if (exam.status !== 'DRAFT') {
            return res.status(400).json({ error: 'Cannot modify published exam' });
        }

        // Get current max order
        const lastQuestion = await prisma.question.findFirst({
            where: { examId: exam.id },
            orderBy: { order: 'desc' }
        });
        let order = lastQuestion ? lastQuestion.order + 1 : 1;

        // Create questions
        let count = 0;
        for (const q of questions) {
            await prisma.question.create({
                data: {
                    examId: exam.id,
                    text: q.text,
                    optionsJson: JSON.stringify(q.options),
                    correctIdx: q.correct_idx ?? q.correctIdx,
                    order: order++
                }
            });
            count++;
        }

        const total = await prisma.question.count({ where: { examId: exam.id } });

        res.status(201).json({ added: count, total });
    } catch (error) {
        console.error('Add questions error:', error);
        res.status(500).json({ error: 'Failed to add questions' });
    }
});

// PUT /api/exams/:id/publish - Publish exam
router.put('/:id/publish', authenticate, requireProfessor, async (req, res) => {
    try {
        const exam = await prisma.exam.findFirst({
            where: { id: req.params.id, professorId: req.user.id },
            include: { _count: { select: { questions: true } } }
        });

        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        if (exam._count.questions === 0) {
            return res.status(400).json({ error: 'Cannot publish exam without questions' });
        }

        const updated = await prisma.exam.update({
            where: { id: exam.id },
            data: { status: 'PUBLISHED' }
        });

        res.json({ id: updated.id, examCode: updated.examCode, status: updated.status });
    } catch (error) {
        console.error('Publish exam error:', error);
        res.status(500).json({ error: 'Failed to publish exam' });
    }
});

// GET /api/exams/:id/monitor - Live monitoring
router.get('/:id/monitor', authenticate, requireProfessor, async (req, res) => {
    try {
        const exam = await prisma.exam.findFirst({
            where: { id: req.params.id, professorId: req.user.id },
            include: { sessions: true }
        });

        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        const now = new Date();
        const sessions = exam.sessions.map(s => {
            const endTime = new Date(s.startedAt.getTime() + exam.durationMin * 60000);
            const remainingMs = Math.max(0, endTime - now);
            const flags = typeof s.flagsJson === 'string' ? JSON.parse(s.flagsJson) : [];

            return {
                rollNumber: s.rollNumber,
                status: s.submittedAt ? 'submitted' : remainingMs > 0 ? 'in_progress' : 'expired',
                remainingMin: Math.ceil(remainingMs / 60000),
                flags: flags.length,
                score: s.score,
                total: s.total,
                startedAt: s.startedAt,
                submittedAt: s.submittedAt
            };
        });

        res.json({ examCode: exam.examCode, sessions });
    } catch (error) {
        console.error('Monitor error:', error);
        res.status(500).json({ error: 'Failed to get monitor data' });
    }
});

// GET /api/exams/:id/export - Export results as CSV
router.get('/:id/export', authenticate, requireProfessor, async (req, res) => {
    try {
        const exam = await prisma.exam.findFirst({
            where: { id: req.params.id, professorId: req.user.id },
            include: { sessions: { where: { submittedAt: { not: null } } } }
        });

        if (!exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        // Build CSV
        const headers = 'roll_number,score,total,percentage,flags,submitted_at\n';
        const rows = exam.sessions.map(s => {
            const flags = typeof s.flagsJson === 'string' ? JSON.parse(s.flagsJson) : [];
            const pct = s.total > 0 ? ((s.score / s.total) * 100).toFixed(1) : 0;
            return `${s.rollNumber},${s.score},${s.total},${pct},${flags.length},${s.submittedAt.toISOString()}`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${exam.title.replace(/[^a-z0-9]/gi, '_')}_results.csv"`);
        res.send(headers + rows);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export results' });
    }
});

module.exports = router;
