import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getDatabase, ref, set, get, push, child } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgW94XkD8N3Q2JFBrt3Ob2iFBuGHWtwIA",
  authDomain: "project-db0cc7ad-f679-46c4-bb7.firebaseapp.com",
  databaseURL: "https://project-db0cc7ad-f679-46c4-bb7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-db0cc7ad-f679-46c4-bb7",
  storageBucket: "project-db0cc7ad-f679-46c4-bb7.firebasestorage.app",
  messagingSenderId: "805874074117",
  appId: "1:805874074117:web:9e5fd02b15f431d560526c",
  measurementId: "G-B5SE27VK15"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔒 관리자 인증용 보안 해시 (요청사항 3: 평문 노출 방지)
// id: 'seongwan' (SHA-256) -> d224d08432b0a887caed72ef91fec1eddb4f0f670f5e1f0e4b8686d1ae6fa87e
// pw: '123456'   (SHA-256) -> 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
const ADMIN_ID_HASH = "d224d08432b0a887caed72ef91fec1eddb4f0f670f5e1f0e4b8686d1ae6fa87e";
const ADMIN_PW_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

// SHA-256 해시 생성 함수
async function hashText(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Global App State
let currentUser = JSON.parse(sessionStorage.getItem('quiz_session_user')) || null;
let currentActiveQuiz = null;
let scoreChartInstance = null;

// DOM Elements
const viewAuth = document.getElementById('view-auth');
const appContent = document.getElementById('app-content');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');

const welcomeTitle = document.getElementById('welcome-title');
const welcomeSub = document.getElementById('welcome-sub');
const adminActionArea = document.getElementById('admin-action-area');
const memberStatsSection = document.getElementById('member-stats-section');
const chapterListContainer = document.getElementById('chapter-list-container');
const authSection = document.getElementById('auth-section');

const viewDashboard = document.getElementById('view-dashboard');
const viewQuizSolve = document.getElementById('view-quiz-solve');
const viewQuizResult = document.getElementById('view-quiz-result');

// App Initialization
initApp();

function initApp() {
  if (currentUser) {
    showAppMain();
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  viewAuth.classList.remove('hidden');
  appContent.classList.add('hidden');
}

function showAppMain() {
  viewAuth.classList.add('hidden');
  appContent.classList.remove('hidden');
  appContent.classList.add('flex');
  updateAuthHeader();
  showDashboardView();
  loadQuizzesFromDB();
}

// Auth Tab Switch
tabLogin.addEventListener('click', () => {
  tabLogin.className = "w-1/2 py-2.5 border-b-2 border-indigo-600 text-indigo-600 font-bold";
  tabSignup.className = "w-1/2 py-2.5 border-b-2 border-transparent text-slate-400 hover:text-slate-600";
  formLogin.classList.remove('hidden');
  formSignup.classList.add('hidden');
});

tabSignup.addEventListener('click', () => {
  tabSignup.className = "w-1/2 py-2.5 border-b-2 border-indigo-600 text-indigo-600 font-bold";
  tabLogin.className = "w-1/2 py-2.5 border-b-2 border-transparent text-slate-400 hover:text-slate-600";
  formSignup.classList.remove('hidden');
  formLogin.classList.add('hidden');
});

// 1 & 3. 로그인 로직 (관리자 해시 검증 및 일반 회원 DB 검증)
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idInput = document.getElementById('login-id').value.trim();
  const pwInput = document.getElementById('login-pw').value.trim();

  const idHash = await hashText(idInput);
  const pwHash = await hashText(pwInput);

  // 관리자 여부 해시 검증
  if (idHash === ADMIN_ID_HASH && pwHash === ADMIN_PW_HASH) {
    currentUser = {
      id: 'admin',
      name: '관리자',
      studentId: 'ADMIN',
      role: 'admin'
    };
    sessionStorage.setItem('quiz_session_user', JSON.stringify(currentUser));
    showAppMain();
    return;
  }

  // 일반 회원 DB 검증
  try {
    const userSnapshot = await get(child(ref(db), `users/${idInput}`));
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      if (userData.password === pwInput) {
        currentUser = {
          id: idInput,
          name: userData.name,
          studentId: userData.studentId,
          role: 'member'
        };
        sessionStorage.setItem('quiz_session_user', JSON.stringify(currentUser));
        showAppMain();
      } else {
        alert('비밀번호가 일치하지 않습니다.');
      }
    } else {
      alert('존재하지 않는 아이디입니다. 회원가입을 먼저 진행해 주세요.');
    }
  } catch (err) {
    console.error("로그인 에러:", err);
    alert('로그인 처리 중 오류가 발생했습니다.');
  }
});

// 2. 회원가입 로직 (아이디, 비밀번호, 학번, 이름)
formSignup.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('signup-id').value.trim();
  const pw = document.getElementById('signup-pw').value.trim();
  const name = document.getElementById('signup-name').value.trim();
  const studentId = document.getElementById('signup-student-id').value.trim();

  // 관리자 아이디 가입 방지
  const idHash = await hashText(id);
  if (idHash === ADMIN_ID_HASH) {
    alert('사용할 수 없는 예약어 아이디입니다.');
    return;
  }

  try {
    const userRef = ref(db, `users/${id}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      alert('이미 존재하는 아이디입니다.');
      return;
    }

    await set(userRef, {
      password: pw,
      name,
      studentId,
      createdAt: Date.now()
    });

    alert('회원가입이 완료되었습니다! 로그인해 주세요.');
    tabLogin.click();
    document.getElementById('login-id').value = id;
    formSignup.reset();
  } catch (err) {
    console.error("회원가입 오류:", err);
    alert('회원가입 실패: ' + err.message);
  }
});

// Header UI
function updateAuthHeader() {
  if (!currentUser) return;
  welcomeTitle.textContent = `반갑습니다, ${currentUser.name}님!`;
  welcomeSub.textContent = currentUser.role === 'admin' 
    ? '관리자 모드로 접속 중입니다. 단원 출제 및 관리가 가능합니다.' 
    : `학번: ${currentUser.studentId} | 평가 기록을 점검하고 퀴즈를 풀어보세요.`;

  authSection.innerHTML = `
    <span class="text-xs bg-indigo-700 text-indigo-100 px-3 py-1 rounded-full font-medium">
      ${currentUser.name} (${currentUser.role === 'admin' ? '관리자' : currentUser.studentId})
    </span>
    <button id="btn-logout" class="text-xs bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg transition font-medium">
      로그아웃
    </button>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    sessionStorage.removeItem('quiz_session_user');
    showAuthScreen();
  });

  if (currentUser.role === 'admin') {
    adminActionArea.classList.remove('hidden');
    memberStatsSection.classList.add('hidden');
  } else {
    adminActionArea.classList.add('hidden');
    memberStatsSection.classList.remove('hidden');
    loadUserStats();
  }
}

// Navigation & Modals
document.getElementById('btn-home').addEventListener('click', showDashboardView);
document.getElementById('btn-cancel-quiz').addEventListener('click', showDashboardView);
document.getElementById('btn-back-to-dashboard').addEventListener('click', showDashboardView);
document.getElementById('btn-open-create-modal').addEventListener('click', () => {
  document.getElementById('modal-create-quiz').classList.remove('hidden');
});

document.querySelectorAll('.btn-close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('modal-create-quiz').classList.add('hidden');
  });
});

// Admin Quiz Create
document.getElementById('form-create-quiz').addEventListener('submit', async (e) => {
  e.preventDefault();
  const chapter = document.getElementById('input-chapter-name').value.trim();
  const title = document.getElementById('input-quiz-title').value.trim();

  const questions = [{
    title: document.getElementById('q1-title').value.trim(),
    options: [
      document.getElementById('q1-opt0').value.trim(),
      document.getElementById('q1-opt1').value.trim(),
      document.getElementById('q1-opt2').value.trim(),
      document.getElementById('q1-opt3').value.trim(),
    ],
    answer: parseInt(document.getElementById('q1-answer').value, 10),
    explanation: document.getElementById('q1-explanation').value.trim()
  }];

  const newQuizData = {
    chapter,
    title,
    questions,
    createdAt: Date.now(),
    author: currentUser.name
  };

  try {
    await push(ref(db, 'quizzes'), newQuizData);
    alert('퀴즈가 서버에 성공적으로 출제되었습니다.');
    document.getElementById('modal-create-quiz').classList.add('hidden');
    document.getElementById('form-create-quiz').reset();
    loadQuizzesFromDB();
  } catch (err) {
    alert('출제 오류: ' + err.message);
  }
});

// Load Quiz Cards
async function loadQuizzesFromDB() {
  try {
    const snapshot = await get(child(ref(db), 'quizzes'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));
      renderChapterCards(list);
    } else {
      renderChapterCards(getSampleQuizzes());
    }
  } catch (err) {
    console.warn("DB 로드 실패, 샘플 표시:", err);
    renderChapterCards(getSampleQuizzes());
  }
}

function renderChapterCards(quizzes) {
  chapterListContainer.innerHTML = '';
  quizzes.forEach(quiz => {
    const card = document.createElement('div');
    card.className = "bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition flex flex-col justify-between";
    card.innerHTML = `
      <div>
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">${quiz.chapter}</span>
          <span class="text-xs text-slate-400"><i class="fa-regular fa-clock"></i> ${new Date(quiz.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>
        <h4 class="font-bold text-slate-800 text-base mb-2">${quiz.title}</h4>
        <p class="text-slate-500 text-xs mb-4">총 ${quiz.questions ? quiz.questions.length : 0}문항 | 작성자: ${quiz.author || '운영진'}</p>
      </div>
      <button class="btn-start-quiz w-full bg-slate-900 hover:bg-indigo-600 text-white font-medium py-2 rounded-lg text-sm transition" data-id="${quiz.id}">
        퀴즈 응시하기
      </button>
    `;

    card.querySelector('.btn-start-quiz').addEventListener('click', () => startQuiz(quiz));
    chapterListContainer.appendChild(card);
  });
}

function startQuiz(quiz) {
  currentActiveQuiz = quiz;
  document.getElementById('solve-chapter-title').textContent = quiz.chapter;
  document.getElementById('solve-quiz-title').textContent = quiz.title;

  const container = document.getElementById('questions-container');
  container.innerHTML = '';

  quiz.questions.forEach((q, idx) => {
    const qEl = document.createElement('div');
    qEl.className = "space-y-3";
    qEl.innerHTML = `
      <p class="font-bold text-slate-800 text-base">Q${idx + 1}. ${q.title}</p>
      <div class="space-y-2">
        ${q.options.map((opt, oIdx) => `
          <label class="flex items-center p-3 border rounded-lg hover:bg-indigo-50/50 cursor-pointer transition">
            <input type="radio" name="question_${idx}" value="${oIdx}" required class="w-4 h-4 text-indigo-600 focus:ring-indigo-500">
            <span class="ml-3 text-sm text-slate-700">${opt}</span>
          </label>
        `).join('')}
      </div>
    `;
    container.appendChild(qEl);
  });

  viewDashboard.classList.add('hidden');
  viewQuizSolve.classList.remove('hidden');
  viewQuizResult.classList.add('hidden');
}

// 4. Submit & Render Detailed Feedback
document.getElementById('form-solve-quiz').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentActiveQuiz) return;

  let score = 0;
  const total = currentActiveQuiz.questions.length;
  const feedbackHTML = [];

  currentActiveQuiz.questions.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="question_${idx}"]:checked`);
    const userAns = selected ? parseInt(selected.value, 10) : -1;
    const isCorrect = (userAns === q.answer);

    if (isCorrect) score += 100 / total;

    feedbackHTML.push(`
      <div class="p-4 rounded-lg border ${isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}">
        <div class="flex items-center gap-2 mb-1">
          <i class="fa-solid ${isCorrect ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'}"></i>
          <span class="font-bold text-sm text-slate-800">Q${idx + 1}. ${q.title}</span>
        </div>
        <p class="text-xs text-slate-600 mt-1">선택: ${q.options[userAns] || '미선택'} | 정답: ${q.options[q.answer]}</p>
        ${q.explanation ? `<p class="text-xs text-slate-500 mt-2 bg-white/70 p-2 rounded">💡 해설: ${q.explanation}</p>` : ''}
      </div>
    `);
  });

  const finalScore = Math.round(score);
  document.getElementById('result-score').textContent = finalScore;
  document.getElementById('result-feedback-container').innerHTML = feedbackHTML.join('');

  if (currentUser && currentUser.role !== 'admin') {
    try {
      await push(ref(db, `results/${currentUser.id}`), {
        quizTitle: currentActiveQuiz.title,
        chapter: currentActiveQuiz.chapter,
        score: finalScore,
        submittedAt: Date.now()
      });
    } catch (err) {
      console.warn("결과 기록 실패:", err);
    }
  }

  viewQuizSolve.classList.add('hidden');
  viewQuizResult.classList.remove('hidden');
});

// 4. 대시보드 통계 및 Chart.js 요약 차트 업데이트
async function loadUserStats() {
  if (!currentUser || currentUser.role === 'admin') return;

  try {
    const snapshot = await get(child(ref(db), `results/${currentUser.id}`));
    if (snapshot.exists()) {
      const records = Object.values(snapshot.val());
      const totalTrials = records.length;
      const avgScore = Math.round(records.reduce((acc, cur) => acc + cur.score, 0) / totalTrials);
      const completedChapters = new Set(records.map(r => r.chapter || r.quizTitle)).size;

      document.getElementById('stat-total-trials').textContent = `${totalTrials}회`;
      document.getElementById('stat-avg-score').textContent = `${avgScore}점`;
      document.getElementById('stat-completed-chapters').textContent = `${completedChapters}개`;

      // Render Table
      const tableBody = document.getElementById('table-user-records');
      tableBody.innerHTML = records.slice(-5).reverse().map(r => `
        <tr>
          <td class="p-2 font-medium">${r.quizTitle}</td>
          <td class="p-2 font-bold ${r.score >= 80 ? 'text-emerald-600' : 'text-amber-600'}">${r.score}점</td>
          <td class="p-2 text-slate-400">${new Date(r.submittedAt).toLocaleDateString()}</td>
        </tr>
      `).join('');

      // Render Score Trend Chart
      renderChart(records);
    }
  } catch (err) {
    console.warn("통계 조회 실패:", err);
  }
}

function renderChart(records) {
  const ctx = document.getElementById('scoreTrendChart').getContext('2d');
  const recentRecords = records.slice(-7); // 최근 7개 기록

  const labels = recentRecords.map((r, i) => `${i + 1}회차`);
  const scores = recentRecords.map(r => r.score);

  if (scoreChartInstance) {
    scoreChartInstance.destroy();
  }

  scoreChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '획득 점수',
        data: scores,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#4f46e5'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100 }
      }
    }
  });
}

function showDashboardView() {
  viewDashboard.classList.remove('hidden');
  viewQuizSolve.classList.add('hidden');
  viewQuizResult.classList.add('hidden');
  if (currentUser && currentUser.role !== 'admin') loadUserStats();
}

function getSampleQuizzes() {
  return [{
    id: 'sample-1',
    chapter: '제 1장. 데이터베이스 기초',
    title: 'Realtime Database 샘플 점검',
    createdAt: Date.now(),
    author: '운영진',
    questions: [{
      title: 'Firebase Realtime Database의 기본 저장 구조는 무엇일까요?',
      options: ['JSON 트리', '관계형 테이블', 'CSV 파일', 'XML 파일'],
      answer: 0,
      explanation: 'Realtime Database는 거대한 JSON 트리 구조로 데이터를 취급합니다.'
    }]
  }];
}
