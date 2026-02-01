const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function generateExamCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function main() {
    console.log('🌱 Seeding database with comprehensive sample data...\n');

    // =================================
    // USERS - Admin, Professors, Students
    // =================================

    // Admin
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@college.edu' },
        update: {},
        create: {
            email: 'admin@college.edu',
            passwordHash: adminPassword,
            name: 'System Admin',
            role: 'ADMIN',
            department: 'Administration'
        }
    });
    console.log('✓ Admin:', admin.email);

    // Professors
    const profPassword = await bcrypt.hash('prof123', 10);

    const profCS = await prisma.user.upsert({
        where: { email: 'prof.sharma@college.edu' },
        update: {},
        create: {
            email: 'prof.sharma@college.edu',
            passwordHash: profPassword,
            name: 'Dr. Anil Sharma',
            role: 'PROFESSOR',
            department: 'Computer Science'
        }
    });
    console.log('✓ Professor:', profCS.email);

    const profMath = await prisma.user.upsert({
        where: { email: 'prof.gupta@college.edu' },
        update: {},
        create: {
            email: 'prof.gupta@college.edu',
            passwordHash: profPassword,
            name: 'Dr. Priya Gupta',
            role: 'PROFESSOR',
            department: 'Mathematics'
        }
    });
    console.log('✓ Professor:', profMath.email);

    // Students
    const studentPassword = await bcrypt.hash('student123', 10);

    const students = [
        { email: 'rahul.kumar@college.edu', name: 'Rahul Kumar', rollNumber: 'CS2024001', department: 'Computer Science' },
        { email: 'priya.singh@college.edu', name: 'Priya Singh', rollNumber: 'CS2024002', department: 'Computer Science' },
        { email: 'amit.patel@college.edu', name: 'Amit Patel', rollNumber: 'CS2024003', department: 'Computer Science' },
        { email: 'sneha.verma@college.edu', name: 'Sneha Verma', rollNumber: 'CS2024004', department: 'Computer Science' },
        { email: 'vikram.joshi@college.edu', name: 'Vikram Joshi', rollNumber: 'CS2024005', department: 'Computer Science' },
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
    // EXAMS
    // =================================

    // Exam 1: Data Structures (Published - Ready to take)
    let exam1 = await prisma.exam.findFirst({ where: { examCode: 'DSA101' } });
    if (!exam1) {
        exam1 = await prisma.exam.create({
            data: {
                examCode: 'DSA101',
                title: 'Data Structures Mid-Term',
                description: 'Mid-term examination covering Arrays, Linked Lists, Stacks, and Queues',
                durationMin: 45,
                template: 'mcq',
                professorId: profCS.id,
                status: 'PUBLISHED'
            }
        });
    }
    console.log('\n✓ Exam:', exam1.title, `(Code: ${exam1.examCode}) - PUBLISHED`);

    // Exam 1 Questions
    const dsaQuestions = [
        { text: 'What is the time complexity of accessing an element in an array by index?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], correctIdx: 0 },
        { text: 'Which data structure uses LIFO (Last In First Out) principle?', options: ['Queue', 'Stack', 'Array', 'Linked List'], correctIdx: 1 },
        { text: 'What is the time complexity of inserting an element at the beginning of a singly linked list?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], correctIdx: 0 },
        { text: 'Which of the following is NOT a linear data structure?', options: ['Array', 'Stack', 'Tree', 'Queue'], correctIdx: 2 },
        { text: 'In a circular queue, when is the queue full?', options: ['front == rear', 'front == (rear + 1) % size', 'rear == size - 1', 'front == 0'], correctIdx: 1 },
        { text: 'What is the minimum number of stacks required to implement a queue?', options: ['1', '2', '3', '4'], correctIdx: 1 },
        { text: 'Which operation takes O(n) time in a singly linked list?', options: ['Insert at head', 'Delete from head', 'Search for an element', 'Check if empty'], correctIdx: 2 },
        { text: 'What is the space complexity of an array of size n?', options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'], correctIdx: 1 },
        { text: 'Which data structure is best for implementing recursion internally?', options: ['Queue', 'Array', 'Stack', 'Linked List'], correctIdx: 2 },
        { text: 'What is a disadvantage of arrays compared to linked lists?', options: ['Random access', 'Fixed size', 'Cache locality', 'Simpler implementation'], correctIdx: 1 },
    ];

    await prisma.question.deleteMany({ where: { examId: exam1.id } });
    for (let i = 0; i < dsaQuestions.length; i++) {
        await prisma.question.create({
            data: {
                examId: exam1.id,
                text: dsaQuestions[i].text,
                optionsJson: JSON.stringify(dsaQuestions[i].options),
                correctIdx: dsaQuestions[i].correctIdx,
                order: i + 1
            }
        });
    }
    console.log(`  └─ Added ${dsaQuestions.length} questions`);

    // Exam 2: DBMS (Published)
    let exam2 = await prisma.exam.findFirst({ where: { examCode: 'DBMS02' } });
    if (!exam2) {
        exam2 = await prisma.exam.create({
            data: {
                examCode: 'DBMS02',
                title: 'Database Management Systems Quiz',
                description: 'Quiz on SQL, Normalization, and ER Diagrams',
                durationMin: 30,
                template: 'mcq',
                professorId: profCS.id,
                status: 'PUBLISHED'
            }
        });
    }
    console.log('✓ Exam:', exam2.title, `(Code: ${exam2.examCode}) - PUBLISHED`);

    const dbmsQuestions = [
        { text: 'Which SQL clause is used to filter rows?', options: ['SELECT', 'FROM', 'WHERE', 'ORDER BY'], correctIdx: 2 },
        { text: 'What does ACID stand for in database transactions?', options: ['Atomicity, Consistency, Isolation, Durability', 'Access, Control, Identity, Data', 'Add, Create, Insert, Delete', 'All, Columns, In, Database'], correctIdx: 0 },
        { text: 'Which normal form eliminates transitive dependencies?', options: ['1NF', '2NF', '3NF', 'BCNF'], correctIdx: 2 },
        { text: 'What is a primary key?', options: ['Any column', 'A unique identifier for each row', 'Foreign reference', 'Index column'], correctIdx: 1 },
        { text: 'Which SQL command is used to add new rows?', options: ['UPDATE', 'INSERT', 'CREATE', 'ALTER'], correctIdx: 1 },
        { text: 'What does the JOIN operation do?', options: ['Deletes rows', 'Combines rows from two tables', 'Creates a new table', 'Updates values'], correctIdx: 1 },
        { text: 'Which constraint ensures a column cannot have NULL values?', options: ['UNIQUE', 'PRIMARY KEY', 'NOT NULL', 'CHECK'], correctIdx: 2 },
        { text: 'What is a foreign key?', options: ['Primary key of same table', 'Reference to primary key of another table', 'Unique column', 'Index column'], correctIdx: 1 },
    ];

    await prisma.question.deleteMany({ where: { examId: exam2.id } });
    for (let i = 0; i < dbmsQuestions.length; i++) {
        await prisma.question.create({
            data: {
                examId: exam2.id,
                text: dbmsQuestions[i].text,
                optionsJson: JSON.stringify(dbmsQuestions[i].options),
                correctIdx: dbmsQuestions[i].correctIdx,
                order: i + 1
            }
        });
    }
    console.log(`  └─ Added ${dbmsQuestions.length} questions`);

    // Exam 3: Mathematics (Draft - for testing exam creation)
    let exam3 = await prisma.exam.findFirst({ where: { examCode: 'MATH03' } });
    if (!exam3) {
        exam3 = await prisma.exam.create({
            data: {
                examCode: 'MATH03',
                title: 'Calculus Quiz (Draft)',
                description: 'Quiz on Differentiation and Integration',
                durationMin: 20,
                template: 'mcq',
                professorId: profMath.id,
                status: 'DRAFT'
            }
        });
    }
    console.log('✓ Exam:', exam3.title, `(Code: ${exam3.examCode}) - DRAFT`);

    // =================================
    // DEVICES
    // =================================

    const devices = [
        { hostname: 'LAB-PC-01', macAddress: 'AA:BB:CC:DD:EE:01', approved: true },
        { hostname: 'LAB-PC-02', macAddress: 'AA:BB:CC:DD:EE:02', approved: true },
        { hostname: 'LAB-PC-03', macAddress: 'AA:BB:CC:DD:EE:03', approved: true },
        { hostname: 'DEMO-LAPTOP', macAddress: 'FF:FF:FF:00:00:01', approved: true },
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

    console.log('\n' + '='.repeat(50));
    console.log('✅ SEEDING COMPLETE!');
    console.log('='.repeat(50));

    console.log('\n📋 LOGIN CREDENTIALS:\n');
    console.log('┌─────────────┬──────────────────────────────┬──────────────┬─────────────┐');
    console.log('│ Role        │ Email                        │ Password     │ Roll Number │');
    console.log('├─────────────┼──────────────────────────────┼──────────────┼─────────────┤');
    console.log('│ Admin       │ admin@college.edu            │ admin123     │ -           │');
    console.log('│ Professor   │ prof.sharma@college.edu      │ prof123      │ -           │');
    console.log('│ Professor   │ prof.gupta@college.edu       │ prof123      │ -           │');
    console.log('│ Student     │ rahul.kumar@college.edu      │ student123   │ CS2024001   │');
    console.log('│ Student     │ priya.singh@college.edu      │ student123   │ CS2024002   │');
    console.log('│ Student     │ amit.patel@college.edu       │ student123   │ CS2024003   │');
    console.log('│ Student     │ sneha.verma@college.edu      │ student123   │ CS2024004   │');
    console.log('│ Student     │ vikram.joshi@college.edu     │ student123   │ CS2024005   │');
    console.log('└─────────────┴──────────────────────────────┴──────────────┴─────────────┘');

    console.log('\n📝 EXAM CODES:\n');
    console.log('┌────────────┬───────────────────────────────────────┬───────────┐');
    console.log('│ Code       │ Exam Title                            │ Status    │');
    console.log('├────────────┼───────────────────────────────────────┼───────────┤');
    console.log('│ DSA101     │ Data Structures Mid-Term              │ PUBLISHED │');
    console.log('│ DBMS02     │ Database Management Systems Quiz      │ PUBLISHED │');
    console.log('│ MATH03     │ Calculus Quiz (Draft)                 │ DRAFT     │');
    console.log('└────────────┴───────────────────────────────────────┴───────────┘');

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
