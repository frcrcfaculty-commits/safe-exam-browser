// Safe Exam Browser - Client Application
(function () {
    'use strict';

    // State
    let serverUrl = '';
    let deviceId = null;
    let sessionId = null;
    let examData = null;
    let currentQuestionIndex = 0;
    let responses = {};
    let timerInterval = null;
    let heartbeatInterval = null;
    let eventQueue = [];

    // DOM Elements
    const screens = {
        loading: document.getElementById('loading-screen'),
        login: document.getElementById('login-screen'),
        exam: document.getElementById('exam-screen'),
        result: document.getElementById('result-screen')
    };

    // Helper to show a screen
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // Update loading status
    function setLoadingStatus(text) {
        document.getElementById('loading-status').textContent = text;
    }

    // Log event (queued for heartbeat)
    function logEvent(type, details = {}) {
        eventQueue.push({
            type,
            details,
            timestamp: new Date().toISOString()
        });
        console.log('Event:', type, details);
    }
    window.__logEvent = logEvent;

    // API helper
    async function api(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (deviceId) headers['X-Device-Id'] = deviceId;
        if (sessionId) headers['X-Session-Id'] = sessionId;

        const response = await fetch(`${serverUrl}${endpoint}`, {
            ...options,
            headers: { ...headers, ...options.headers },
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // Initialize app
    async function init() {
        try {
            setLoadingStatus('Connecting to server...');
            serverUrl = await window.electronAPI.getServerUrl();

            setLoadingStatus('Checking device registration...');
            deviceId = await window.electronAPI.getDeviceId();

            if (!deviceId) {
                // Register device
                const hostname = await window.electronAPI.getHostname();
                setLoadingStatus('Registering device...');

                const result = await api('/api/client/register', {
                    method: 'POST',
                    body: { hostname }
                });

                deviceId = result.deviceId;
                await window.electronAPI.saveDeviceId(deviceId);

                if (result.status === 'pending_approval') {
                    document.getElementById('device-status').textContent = '⏳ Device pending approval';
                }
            }

            // Load available exams
            setLoadingStatus('Loading exams...');
            await loadExams();

            document.getElementById('device-status').textContent = '✅ Device registered';
            showScreen('login');

        } catch (error) {
            console.error('Init error:', error);
            setLoadingStatus(`Error: ${error.message}`);
        }
    }

    // Load available exams
    async function loadExams() {
        try {
            const result = await api('/api/client/exams');
            const select = document.getElementById('exam-select');

            if (result.exams.length === 0) {
                select.innerHTML = '<option value="">No exams available</option>';
                return;
            }

            select.innerHTML = result.exams.map(e =>
                `<option value="${e.id}">${e.title} (${e.durationMin} min, ${e.questionCount} questions)</option>`
            ).join('');

        } catch (error) {
            console.error('Load exams error:', error);
            document.getElementById('exam-select').innerHTML = '<option value="">Failed to load exams</option>';
        }
    }

    // Start exam
    async function startExam(rollNumber, examId) {
        try {
            document.getElementById('start-btn').disabled = true;
            document.getElementById('login-error').textContent = '';

            // Start session on server
            const startResult = await api('/api/client/start', {
                method: 'POST',
                body: { rollNumber, examId }
            });

            sessionId = startResult.sessionId;

            // Enable exam mode (kiosk, shortcuts blocked)
            await window.electronAPI.startExamMode();
            window.__examActive = true;

            // Fetch exam questions
            examData = await api('/api/client/exam');
            examData.startedAt = new Date(startResult.startedAt);
            examData.durationMin = startResult.durationMin;

            // Initialize responses from any saved data
            examData.questions.forEach(q => {
                if (q.selectedIdx !== null) {
                    responses[q.id] = q.selectedIdx;
                }
            });

            // Setup UI
            setupExamUI();
            showScreen('exam');

            // Start timer and heartbeat
            startTimer();
            startHeartbeat();

            // Setup focus detection
            setupFocusDetection();

        } catch (error) {
            console.error('Start exam error:', error);
            document.getElementById('login-error').textContent = error.message;
            document.getElementById('start-btn').disabled = false;
        }
    }

    // Setup exam UI
    function setupExamUI() {
        document.getElementById('exam-title').textContent = examData.examTitle;
        document.getElementById('total-questions').textContent = examData.questions.length;

        // Create question navigation dots
        const grid = document.getElementById('question-grid');
        grid.innerHTML = examData.questions.map((q, i) =>
            `<div class="question-dot ${i === 0 ? 'current' : ''} ${responses[q.id] !== undefined ? 'answered' : ''}" data-index="${i}">${i + 1}</div>`
        ).join('');

        // Add click handlers to dots
        grid.querySelectorAll('.question-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                goToQuestion(parseInt(dot.dataset.index));
            });
        });

        // Show first question
        showQuestion(0);
    }

    // Show a question
    function showQuestion(index) {
        const question = examData.questions[index];
        currentQuestionIndex = index;

        document.getElementById('current-question').textContent = index + 1;
        document.getElementById('question-text').textContent = question.text;

        const optionsList = document.getElementById('options-list');
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

        optionsList.innerHTML = question.options.map((opt, i) => `
      <button class="option-btn ${responses[question.id] === i ? 'selected' : ''}" data-index="${i}">
        <span class="option-letter">${letters[i]}</span>
        <span class="option-text">${opt}</span>
      </button>
    `).join('');

        // Add click handlers
        optionsList.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => selectOption(parseInt(btn.dataset.index)));
        });

        // Update navigation buttons
        document.getElementById('prev-btn').disabled = index === 0;
        document.getElementById('next-btn').textContent = index === examData.questions.length - 1 ? 'Review' : 'Next →';

        // Update dots
        document.querySelectorAll('.question-dot').forEach((dot, i) => {
            dot.classList.toggle('current', i === index);
        });
    }

    // Select an option
    async function selectOption(optionIndex) {
        const question = examData.questions[currentQuestionIndex];
        responses[question.id] = optionIndex;

        // Update UI
        document.querySelectorAll('.option-btn').forEach((btn, i) => {
            btn.classList.toggle('selected', i === optionIndex);
        });

        // Update dot
        document.querySelectorAll('.question-dot')[currentQuestionIndex].classList.add('answered');

        // Auto-save to server
        try {
            await api('/api/client/save', {
                method: 'POST',
                body: { questionId: question.id, selectedIdx: optionIndex }
            });
        } catch (error) {
            console.error('Auto-save error:', error);
        }
    }

    // Navigation
    function goToQuestion(index) {
        if (index >= 0 && index < examData.questions.length) {
            showQuestion(index);
        }
    }

    // Timer
    function startTimer() {
        const endTime = new Date(examData.startedAt.getTime() + examData.durationMin * 60000);

        function updateTimer() {
            const now = new Date();
            const remainingMs = Math.max(0, endTime - now);
            const remainingMin = Math.floor(remainingMs / 60000);
            const remainingSec = Math.floor((remainingMs % 60000) / 1000);

            const timerEl = document.getElementById('timer');
            timerEl.textContent = `${String(remainingMin).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`;

            // Warning when less than 5 minutes
            if (remainingMin < 5) {
                timerEl.classList.add('warning');
            }

            // Auto-submit when time is up
            if (remainingMs <= 0) {
                clearInterval(timerInterval);
                submitExam(true);
            }
        }

        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }

    // Heartbeat
    function startHeartbeat() {
        async function sendHeartbeat() {
            try {
                const events = [...eventQueue];
                eventQueue = [];

                const result = await api('/api/client/heartbeat', {
                    method: 'POST',
                    body: { events }
                });

                if (!result.continue) {
                    // Exam ended by server
                    submitExam(true);
                }
            } catch (error) {
                console.error('Heartbeat error:', error);
            }
        }

        heartbeatInterval = setInterval(sendHeartbeat, 30000);
    }

    // Focus detection
    function setupFocusDetection() {
        window.addEventListener('blur', () => {
            logEvent('focus_lost');
        });

        window.addEventListener('focus', () => {
            logEvent('focus_regained');
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                logEvent('tab_hidden');
            } else {
                logEvent('tab_visible');
            }
        });

        // Listen for blocked shortcuts from main process
        window.electronAPI.onBlockedShortcut((data) => {
            logEvent('blocked_shortcut', data);
        });
    }

    // Submit exam
    async function submitExam(autoSubmit = false) {
        try {
            if (!autoSubmit) {
                const unanswered = examData.questions.filter(q => responses[q.id] === undefined).length;
                if (unanswered > 0) {
                    if (!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) {
                        return;
                    }
                } else {
                    if (!confirm('Are you sure you want to submit your exam?')) {
                        return;
                    }
                }
            }

            // Stop timer and heartbeat
            clearInterval(timerInterval);
            clearInterval(heartbeatInterval);

            // Prepare responses array
            const responsesArray = Object.entries(responses).map(([questionId, selectedIdx]) => ({
                questionId,
                selectedIdx
            }));

            // Submit to server
            const result = await api('/api/client/submit', {
                method: 'POST',
                body: { responses: responsesArray }
            });

            // End exam mode
            await window.electronAPI.endExamMode();
            window.__examActive = false;

            // Show result
            document.getElementById('result-score').textContent = result.score;
            document.getElementById('result-total').textContent = result.total;
            document.getElementById('result-percentage').textContent = `${result.percentage}%`;

            showScreen('result');

        } catch (error) {
            console.error('Submit error:', error);
            alert('Failed to submit exam. Please try again.');
        }
    }

    // Exit app
    function exitApp() {
        window.close();
    }

    // Event listeners
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const rollNumber = document.getElementById('roll-number').value.trim();
        const examId = document.getElementById('exam-select').value;

        if (rollNumber && examId) {
            startExam(rollNumber, examId);
        }
    });

    document.getElementById('prev-btn').addEventListener('click', () => {
        goToQuestion(currentQuestionIndex - 1);
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        goToQuestion(currentQuestionIndex + 1);
    });

    document.getElementById('submit-btn').addEventListener('click', () => {
        submitExam(false);
    });

    document.getElementById('exit-btn').addEventListener('click', exitApp);

    // Start app
    init();
})();
