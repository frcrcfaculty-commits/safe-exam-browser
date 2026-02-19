const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database with Fr. Agnel College sample data...\n');

    // =================================
    // USERS - Admin, Faculty, Students
    // =================================

    // Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@fragnel.edu.in' },
        update: {},
        create: {
            email: 'admin@fragnel.edu.in',
            passwordHash: adminPassword,
            name: 'System Administrator',
            role: 'ADMIN',
            department: 'Administration'
        }
    });
    console.log('✓ Admin:', admin.email);

    // Faculty Members
    const facPassword = await bcrypt.hash('faculty123', 10);

    const faculty1 = await prisma.user.upsert({
        where: { email: 'prof.dsilva@fragnel.edu.in' },
        update: {},
        create: {
            email: 'prof.dsilva@fragnel.edu.in',
            passwordHash: facPassword,
            name: 'Dr. Maria D\'Silva',
            role: 'PROFESSOR',
            department: 'Computer Science'
        }
    });
    console.log('✓ Faculty:', faculty1.email);

    const faculty2 = await prisma.user.upsert({
        where: { email: 'prof.fernandes@fragnel.edu.in' },
        update: {},
        create: {
            email: 'prof.fernandes@fragnel.edu.in',
            passwordHash: facPassword,
            name: 'Prof. Anthony Fernandes',
            role: 'PROFESSOR',
            department: 'Commerce'
        }
    });
    console.log('✓ Faculty:', faculty2.email);

    const faculty3 = await prisma.user.upsert({
        where: { email: 'prof.naik@fragnel.edu.in' },
        update: {},
        create: {
            email: 'prof.naik@fragnel.edu.in',
            passwordHash: facPassword,
            name: 'Prof. Sunita Naik',
            role: 'PROFESSOR',
            department: 'Mathematics'
        }
    });
    console.log('✓ Faculty:', faculty3.email);

    // Students
    const studentPassword = await bcrypt.hash('student123', 10);

    const students = [
        { email: 'rohan.gomes@fragnel.edu.in', name: 'Rohan Gomes', rollNumber: 'FYBSC001', department: 'Computer Science' },
        { email: 'priya.pereira@fragnel.edu.in', name: 'Priya Pereira', rollNumber: 'FYBSC002', department: 'Computer Science' },
        { email: 'akash.shetty@fragnel.edu.in', name: 'Akash Shetty', rollNumber: 'FYBSC003', department: 'Computer Science' },
        { email: 'anita.rodrigues@fragnel.edu.in', name: 'Anita Rodrigues', rollNumber: 'FYBCOM001', department: 'Commerce' },
        { email: 'nikhil.desai@fragnel.edu.in', name: 'Nikhil Desai', rollNumber: 'FYBCOM002', department: 'Commerce' },
        { email: 'kavita.pawar@fragnel.edu.in', name: 'Kavita Pawar', rollNumber: 'SYBSC001', department: 'Computer Science' },
    ];

    for (const s of students) {
        await prisma.user.upsert({
            where: { email: s.email },
            update: {},
            create: {
                email: s.email,
                passwordHash: studentPassword,
                name: s.name,
                role: 'STUDENT',
                department: s.department,
                rollNumber: s.rollNumber
            }
        });
        console.log('✓ Student:', s.name, `(${s.rollNumber})`);
    }

    // =================================
    // EXAMS - Ready for testing
    // =================================

    // Exam 1: Computer Fundamentals (Published - Ready to take!)
    let exam1 = await prisma.exam.findFirst({ where: { examCode: 'COMP01' } });
    if (!exam1) {
        exam1 = await prisma.exam.create({
            data: {
                examCode: 'COMP01',
                title: 'Computer Fundamentals - Unit Test 1',
                description: 'Basic concepts of computers, input/output devices, and software',
                durationMin: 30,
                template: 'mcq',
                professorId: faculty1.id,
                status: 'PUBLISHED'
            }
        });
    }
    console.log('\n✓ Exam:', exam1.title, `(Code: ${exam1.examCode}) - PUBLISHED ✅ READY`);

    const compQuestions = [
        { text: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Control Processing Unit'], correctIdx: 0 },
        { text: 'Which of the following is an input device?', options: ['Monitor', 'Printer', 'Keyboard', 'Speaker'], correctIdx: 2 },
        { text: 'RAM stands for:', options: ['Random Access Memory', 'Read Access Memory', 'Run Access Memory', 'Random Available Memory'], correctIdx: 0 },
        { text: 'Which is NOT an operating system?', options: ['Windows', 'Linux', 'Microsoft Word', 'macOS'], correctIdx: 2 },
        { text: '1 KB equals how many bytes?', options: ['1000 bytes', '1024 bytes', '512 bytes', '2048 bytes'], correctIdx: 1 },
        { text: 'Which device is used for permanent storage?', options: ['RAM', 'Cache', 'Hard Disk', 'Register'], correctIdx: 2 },
        { text: 'USB stands for:', options: ['Universal Serial Bus', 'Unified System Bus', 'Universal System Backup', 'United Serial Block'], correctIdx: 0 },
        { text: 'Which is an example of system software?', options: ['MS Word', 'Chrome', 'Operating System', 'Excel'], correctIdx: 2 },
        { text: 'The brain of a computer is:', options: ['Monitor', 'CPU', 'RAM', 'Hard Disk'], correctIdx: 1 },
        { text: 'What type of software is Google Chrome?', options: ['System Software', 'Application Software', 'Firmware', 'Utility Software'], correctIdx: 1 },
    ];

    await prisma.question.deleteMany({ where: { examId: exam1.id } });
    for (let i = 0; i < compQuestions.length; i++) {
        await prisma.question.create({
            data: {
                examId: exam1.id,
                text: compQuestions[i].text,
                optionsJson: JSON.stringify(compQuestions[i].options),
                correctIdx: compQuestions[i].correctIdx,
                order: i + 1
            }
        });
    }
    console.log(`  └─ Added ${compQuestions.length} questions`);

    // Exam 2: Business Studies (Published)
    let exam2 = await prisma.exam.findFirst({ where: { examCode: 'BCOM01' } });
    if (!exam2) {
        exam2 = await prisma.exam.create({
            data: {
                examCode: 'BCOM01',
                title: 'Business Studies Quiz',
                description: 'Introduction to Business, Commerce, and Trade',
                durationMin: 20,
                template: 'mcq',
                professorId: faculty2.id,
                status: 'PUBLISHED'
            }
        });
    }
    console.log('✓ Exam:', exam2.title, `(Code: ${exam2.examCode}) - PUBLISHED ✅`);

    const bcomQuestions = [
        { text: 'Commerce includes:', options: ['Trade only', 'Trade and aids to trade', 'Industry only', 'Agriculture only'], correctIdx: 1 },
        { text: 'Which is NOT an aid to trade?', options: ['Banking', 'Insurance', 'Farming', 'Transport'], correctIdx: 2 },
        { text: 'What is the main objective of a business?', options: ['Social service', 'Profit earning', 'Employment', 'Charity'], correctIdx: 1 },
        { text: 'Which type of business has unlimited liability?', options: ['Company', 'Sole Proprietorship', 'Cooperative', 'Corporation'], correctIdx: 1 },
        { text: 'GST stands for:', options: ['General Service Tax', 'Goods and Services Tax', 'Government Sales Tax', 'Global Standard Tax'], correctIdx: 1 },
        { text: 'E-commerce refers to:', options: ['Electronic Commerce', 'Easy Commerce', 'Economic Commerce', 'Export Commerce'], correctIdx: 0 },
    ];

    await prisma.question.deleteMany({ where: { examId: exam2.id } });
    for (let i = 0; i < bcomQuestions.length; i++) {
        await prisma.question.create({
            data: {
                examId: exam2.id,
                text: bcomQuestions[i].text,
                optionsJson: JSON.stringify(bcomQuestions[i].options),
                correctIdx: bcomQuestions[i].correctIdx,
                order: i + 1
            }
        });
    }
    console.log(`  └─ Added ${bcomQuestions.length} questions`);

    // Exam 3: Mathematics (Draft)
    let exam3 = await prisma.exam.findFirst({ where: { examCode: 'MATH01' } });
    if (!exam3) {
        exam3 = await prisma.exam.create({
            data: {
                examCode: 'MATH01',
                title: 'Mathematics Mid-Term (Draft)',
                description: 'Algebra and Calculus basics',
                durationMin: 45,
                template: 'mcq',
                professorId: faculty3.id,
                status: 'DRAFT'
            }
        });
    }
    console.log('✓ Exam:', exam3.title, `(Code: ${exam3.examCode}) - DRAFT`);

    // =================================
    // DEVICES
    // =================================

    const devices = [
        { hostname: 'LAB-A-PC01', macAddress: 'AA:BB:CC:DD:EE:01', approved: true },
        { hostname: 'LAB-A-PC02', macAddress: 'AA:BB:CC:DD:EE:02', approved: true },
        { hostname: 'LAB-B-PC01', macAddress: 'AA:BB:CC:DD:EE:03', approved: true },
    ];

    for (const d of devices) {
        await prisma.device.upsert({
            where: { hostname: d.hostname },
            update: {},
            create: d
        });
    }
    console.log('\n✓ Created', devices.length, 'approved lab devices');

    // =================================
    // SUMMARY
    // =================================

    console.log('\n' + '═'.repeat(60));
    console.log('  ✅ FR. AGNEL COLLEGE - DATABASE READY');
    console.log('═'.repeat(60));

    console.log('\n📋 FACULTY LOGIN:\n');
    console.log('┌──────────────────────────────────┬──────────────┐');
    console.log('│ Email                            │ Password     │');
    console.log('├──────────────────────────────────┼──────────────┤');
    console.log('│ prof.dsilva@fragnel.edu.in       │ faculty123   │');
    console.log('│ prof.fernandes@fragnel.edu.in    │ faculty123   │');
    console.log('│ prof.naik@fragnel.edu.in         │ faculty123   │');
    console.log('└──────────────────────────────────┴──────────────┘');

    console.log('\n👨‍🎓 STUDENT LOGIN:\n');
    console.log('┌──────────────────────────────────┬──────────────┬───────────┐');
    console.log('│ Email                            │ Password     │ Roll No.  │');
    console.log('├──────────────────────────────────┼──────────────┼───────────┤');
    console.log('│ rohan.gomes@fragnel.edu.in       │ student123   │ FYBSC001  │');
    console.log('│ priya.pereira@fragnel.edu.in     │ student123   │ FYBSC002  │');
    console.log('│ anita.rodrigues@fragnel.edu.in   │ student123   │ FYBCOM001 │');
    console.log('└──────────────────────────────────┴──────────────┴───────────┘');

    console.log('\n📝 READY EXAM CODES (Students can enter these immediately):\n');
    console.log('┌──────────┬─────────────────────────────────────┬───────────┐');
    console.log('│ Code     │ Exam Title                          │ Status    │');
    console.log('├──────────┼─────────────────────────────────────┼───────────┤');
    console.log('│ COMP01   │ Computer Fundamentals - Unit Test 1 │ ✅ READY  │');
    console.log('│ BCOM01   │ Business Studies Quiz               │ ✅ READY  │');
    console.log('│ MATH01   │ Mathematics Mid-Term                │ 📝 DRAFT  │');
    console.log('└──────────┴─────────────────────────────────────┴───────────┘');

    console.log('\n🌐 SERVER URL: http://localhost:3001\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
