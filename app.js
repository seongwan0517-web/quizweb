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

// 관리자 해시 (seongwan / 123456)
const ADMIN_ID_HASH = "d224d08432b0a887caed72ef91fec1eddb4f0f670f5e1f0e4b8686d1ae6fa87e";
const ADMIN_PW_HASH = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92";

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

// Kakao SDK 안전 초기화
function initKakaoSDK() {
  const KAKAO_KEY = "f5672116e00acade1409749490575059";
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_KEY);
    console.log("Kakao SDK Initialized Success");
  }
}

// ✨ HTML onclick에서 직접 호출할 수 있도록 window 객체에 등록
window.handleKakaoLogin = function() {
  initKakaoSDK();

  if (!window.Kakao || !window.Kakao.Auth) {
    alert("카카오 SDK를 불러오는 중입니다. 페이지를 다시 고침 후 시도해 보세요.");
    return;
  }

  window.Kakao.Auth.login({
    success: function (authObj) {
      window.Kakao.API.request({
        url: '/v2/user/me',
        success: async function (res) {
          const kakaoId = `kakao_${res.id}`;
          const kakaoName = res.kakao_account?.profile?.nickname || '카카오 사용자';

          try {
            const userRef = ref(db, `users/${kakaoId}`);
            const snapshot = await get(userRef);

            let studentId = "카카오회원";

            if (!snapshot.exists()) {
              const inputStudentId = prompt(`${kakaoName}님, 학번을 입력해 주세요:`, "20260000");
              if (inputStudentId) studentId = inputStudentId.trim();

              await set(userRef, {
                password: 'KAKAO_SOCIAL_USER',
                name: kakaoName,
                studentId: studentId,
                createdAt: Date.now()
              });
            } else {
              studentId = snapshot.val().studentId || studentId;
            }

            currentUser = {
              id: kakaoId,
              name: kakaoName,
              studentId: studentId,
              role: 'member'
            };

            sessionStorage.setItem('quiz_session_user', JSON.stringify(currentUser));
            showAppMain();
          } catch (err) {
            console.error("카카오 회원 DB 처리 실패:", err);
            alert("로그인 처리 중 오류가 발생했습니다.");
          }
        },
        fail: function (error) {
          console.error("사용자 정보 조회 실패:", error);
        }
      });
    },
    fail: function (err) {
      console.error("카카오 로그인 실패:", err);
      alert("카카오 로그인 창을 불러오지 못했습니다.");
    }
  });
};

// DOM Initialization
window.addEventListener('DOMContentLoaded', () => {
  initKakaoSDK();
  initApp();
});

function initApp() {
  if (currentUser) {
    showAppMain();
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('view-auth').classList.remove('hidden');
  document.getElementById('app-content').classList.add('hidden');
}

function showAppMain() {
  document.getElementById('view-auth').classList.add('hidden');
  const appContent = document.getElementById('app-content');
  appContent.classList.remove('hidden');
  appContent.classList.add('flex');
  updateAuthHeader();
  showDashboardView();
  loadQuizzesFromDB();
}

// Tab Switch
document.getElementById('tab-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('tab-login').className = "w-1/2 py-2.5 border-b-2 border-indigo-600 text-indigo-600 font-bold";
  document.getElementById('tab-signup').className = "w-1/2 py-2.5 border-b-2 border-transparent text-slate-400 hover:text-slate-600";
  document.getElementById('form-login').classList.remove('hidden');
  document.getElementById('form-signup').classList.add('hidden');
});

document.getElementById('tab-signup')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('tab-signup').className = "w-1/2 py-2.5 border-b-2 border-indigo-600 text-indigo-600 font-bold";
  document.getElementById('tab-login').className = "w-1/2 py-2.5 border-b-2 border-transparent text-slate-400 hover:text-slate-600";
  document.getElementById('form-signup').classList.remove('hidden');
  document.getElementById('form-login').classList.add('hidden');
});

// Login Form Submit
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const idInput = document.getElementById('login-id').value.trim();
  const pwInput = document.getElementById('login-pw').value.trim();

  if (!idInput || !pwInput) {
    alert('아이디와 비밀번호를 모두 입력해 주세요.');
    return;
  }

  const idHash = await hashText(idInput);
  const pwHash = await hashText(pwInput);

  if (idInput === 'seongwan' || idHash === ADMIN_ID_HASH) {
    if (pwInput === '123456' || pwHash === ADMIN_PW_HASH) {
      currentUser = {
        id: 'seongwan',
        name: '관리자',
        studentId: 'ADMIN',
        role: 'admin'
      };
      sessionStorage.setItem('quiz_session_user', JSON.stringify(currentUser));
      showAppMain();
      return;
    } else {
      alert('관리자 비밀번호가 일치하지 않습니다.');
      return;
    }
  }

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

// Signup Form Submit
document.getElementById('form-signup')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('signup-id').value.trim();
  const pw = document.getElementById('signup-pw').value.trim();
  const name = document.getElementById('signup-name').value.trim();
  const studentId = document.getElementById('signup-student-id').value.trim();

  if (!id || !pw || !name || !studentId) {
    alert('모든 항목을 입력해 주세요.');
    return;
  }

  if (id === 'seongwan') {
    alert('사용할 수 없는 아이디입니다.');
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
      name: name,
      studentId: studentId,
      createdAt: Date.now()
    });

    alert('회원가입이 완료되었습니다! 로그인해 주세요.');
    document.getElementById('tab-login').click();
    document.getElementById('login-id').value = id;
    document.getElementById('form-signup').reset();
  } catch (err) {
    alert('회원가입 실패: ' + err.message);
  }
});

// Update Header
function updateAuthHeader() {
  if (!currentUser) return;
  document.getElementById('welcome-title').textContent = `반갑습니다, ${currentUser.name}님!`;
  document.getElementById('welcome-sub').textContent = currentUser.role === 'admin' 
    ? '관리자 모드로 접속 중입니다. 퀴즈 출제 및 관리가 가능합니다.' 
    : `학번: ${currentUser.studentId} | 평가 기록을 점검하고 퀴즈를 풀어보세요.`;

  const authSection = document.getElementById('auth-section');
  authSection.innerHTML = `
    <span class="text-xs bg-indigo-700 text-indigo-100 px-3 py-1 rounded-full font-medium">
      ${currentUser.name} (${currentUser.role === 'admin' ? '관리자' : currentUser.studentId})
    </span>
    <button id="btn-logout" type="button" class="text-xs bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg transition font-medium">
      로그아웃
    </button>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    sessionStorage.removeItem('quiz_session_user');
    showAuthScreen();
  });

  const adminArea = document.getElementById('admin-action-area');
  const memberArea = document.getElementById('member-stats-section');
  if (currentUser.role === 'admin') {
    adminArea.classList.remove('hidden');
    memberArea.classList.add('hidden');
  } else {
    adminArea.classList.add('hidden');
    memberArea.classList.remove('hidden');
    loadUserStats();
  }
}

// Navigation & Modals
document.getElementById('btn-home')?.addEventListener('click', showDashboardView);
document.getElementById('btn-cancel-quiz')?.addEventListener('click', showDashboardView);
document.getElementById('btn-back-to-dashboard')?.addEventListener('click', showDashboardView);
document.getElementById('btn-open-create-modal')?.addEventListener('click', () => {
  document.getElementById('modal-create-quiz').classList.remove('hidden');
});

document.querySelectorAll('.btn-close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('modal-create-quiz').classList.add('hidden');
  });
});

// Create Quiz
document.getElementById('form-create-quiz')?.addEventListener('submit', async (e) => {
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

// Load Quizzes
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
    renderChapterCards(getSampleQuizzes());
  }
}

function renderChapterCards(quizzes) {
  const container = document.getElementById('chapter-list-container');
  if (!container) return;
  container.innerHTML = '';
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
      <button type="button" class="btn-start-quiz w-full bg-slate-900 hover:bg-indigo-600 text-white font-medium py-2 rounded-lg text-sm transition" data-id="${quiz.id}">
        퀴즈 응시하기
      </button>
    `;

    card.querySelector('.btn-start-quiz').addEventListener('click', () => startQuiz(quiz));
    container.appendChild(card);
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

  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-quiz-solve').classList.remove('hidden');
  document.getElementById('view-quiz-result').classList.add('hidden');
}

// Submit Quiz
document.getElementById('form-solve-quiz')?.addEventListener('submit', async (e) => {
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

  document.getElementById('view-quiz-solve').classList.add('hidden');
  document.getElementById('view-quiz-result').classList.add('hidden');
});

// Load Stats
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

      const tableBody = document.getElementById('table-user-records');
      tableBody.innerHTML = records.slice(-5).reverse().map(r => `
        <tr>
          <td class="p-2 font-medium">${r.quizTitle}</td>
          <td class="p-2 font-bold ${r.score >= 80 ? 'text-emerald-600' : 'text-amber-600'}">${r.score}점</td>
          <td class="p-2 text-slate-400">${new Date(r.submittedAt).toLocaleDateString()}</td>
        </tr>
      `).join('');

      renderChart(records);
    }
  } catch (err) {
    console.warn("통계 조회 실패:", err);
  }
}

function renderChart(records) {
  const ctx = document.getElementById('scoreTrendChart')?.getContext('2d');
  if (!ctx) return;

  const recentRecords = records.slice(-7);
  const labels = recentRecords.map((r, i) => `${i + 1}회차`);
  const scores = recentRecords.map(r => r.score);

  if (scoreChartInstance) scoreChartInstance.destroy();

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
      scales: { y: { min: 0, max: 100 } }
    }
  });
}

function showDashboardView() {
  document.getElementById('view-dashboard').classList.remove('hidden');
  document.getElementById('view-quiz-solve').classList.add('hidden');
  document.getElementById('view-quiz-result').classList.add('hidden');
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
