const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department: user.department,
                rollNumber: user.rollNumber
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/register - Self-registration for Faculty/Student
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, department, role, rollNumber } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name required' });
        }

        if (!department) {
            return res.status(400).json({ error: 'Department is required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Validate role
        const validRoles = ['PROFESSOR', 'STUDENT'];
        const userRole = validRoles.includes(role) ? role : 'PROFESSOR';

        // Students must have roll number
        if (userRole === 'STUDENT' && !rollNumber) {
            return res.status(400).json({ error: 'Roll number is required for students' });
        }

        const existing = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Check if roll number already exists
        if (rollNumber) {
            const existingRoll = await prisma.user.findUnique({
                where: { rollNumber }
            });
            if (existingRoll) {
                return res.status(409).json({ error: 'Roll number already registered' });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                passwordHash,
                name,
                role: userRole,
                department,
                rollNumber: userRole === 'STUDENT' ? rollNumber : null
            }
        });

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department: user.department,
                rollNumber: user.rollNumber
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/register-admin - Admin registration (requires existing admin)
router.post('/register-admin', authenticate, requireAdmin, async (req, res) => {
    try {
        const { email, password, name, department } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name required' });
        }

        if (!department) {
            return res.status(400).json({ error: 'Department is required' });
        }

        const existing = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                passwordHash,
                name,
                role: 'ADMIN',
                department
            }
        });

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Register admin error:', error);
        res.status(500).json({ error: 'Admin registration failed' });
    }
});

// PUT /api/auth/update-department - Update department for logged-in user
router.put('/update-department', authenticate, async (req, res) => {
    try {
        const { department } = req.body;

        if (!department) {
            return res.status(400).json({ error: 'Department is required' });
        }

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: { department }
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        console.error('Update department error:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
});

module.exports = router;
