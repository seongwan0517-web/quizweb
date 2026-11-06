import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getDatabase, ref, set, get, push, child } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

// Firebase 설정
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State
let currentUser = JSON.parse(localStorage.getItem('quiz_user')) || null;
let currentActiveQuiz = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const adminActionArea = document.getElementById('admin-action-area');
const welcomeTitle = document.getElementById('welcome-title');
const chapterListContainer = document.getElementById('chapter-list-container');
const userStatsCard = document.getElementById('user-stats-card');

const viewDashboard = document.getElementById('view-dashboard');
const viewQuizSolve = document.getElementById('view-quiz-solve');
const viewQuizResult = document.getElementById('view-quiz-result');

// Init Sync
updateAuthUI();
loadQuizzesFromDB();

// Navigation Events
document.getElementById('btn-home').addEventListener('click', showDashboardView);
document.getElementById('btn-cancel-quiz').addEventListener('click', showDashboardView);
document.getElementById('btn-back-to-dashboard').addEventListener('click', showDashboardView);
document.getElementById('btn-open-create-modal').addEventListener('click', () => {
  document.getElementById('modal-create-quiz').classList.remove('hidden');
});

// Close Modals
document.querySelectorAll('.btn-close-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('modal-auth').classList.add('hidden');
    document.getElementById('modal-create-quiz').classList.add('hidden');
  });
});

// Auth Form Handler
document.getElementById('form-auth').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim();
  const role = document.getElementById('auth-role').value;

  if (!username) return;

  currentUser = { username, role };
  localStorage.setItem('quiz_user', JSON.stringify(currentUser));
  updateAuthUI();
  document.getElementById('modal-auth').classList.add('hidden');
});

function updateAuthUI() {
  if (currentUser) {
    welcomeTitle.textContent = `반갑습니다, ${currentUser.username}님! (${currentUser.role === 'admin' ? '운영진' : '일반 회원'})`;
    authSection.innerHTML = `
      <span class="text-sm font-medium text-indigo-100">${currentUser.username} (${currentUser.role === 'admin' ? '운영진' : '회원'})</span>
      <button id="btn-logout" class="text-xs bg-indigo-700 hover:bg-indigo-800 px-3 py-1.5 rounded transition">로그아웃</button>
    `;
    document.getElementById('btn-logout').addEventListener('click', () => {
      currentUser = null;
      localStorage.removeItem('quiz_user');
      updateAuthUI();
    });

    if (currentUser.role === 'admin') {
      adminActionArea.classList.remove('hidden');
      userStatsCard.classList.add('hidden');
    } else {
      adminActionArea.classList.add('hidden');
      userStatsCard.classList.remove('hidden');
      loadUserStats();
    }
  } else {
    welcomeTitle.textContent = "안녕하세요! 로그인이 필요합니다.";
    userStatsCard.classList.add('hidden');
    adminActionArea.classList.add('hidden');
    authSection.innerHTML = `
      <button id="btn-login-modal" class="text-sm bg-white text-indigo-600 hover:bg-indigo-50 font-medium px-4 py-1.5 rounded-lg transition shadow-sm">
        로그인 / 가입
      </button>
    `;
    document.getElementById('btn-login-modal').addEventListener('click', () => {
      document.getElementById('modal-auth').classList.remove('hidden');
    });
  }
}

// Create Quiz Form Handler
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
    author: currentUser ? currentUser.username : '운영진'
  };

  try {
    const quizzesRef = ref(db, 'quizzes');
    const newQuizRef = push(quizzesRef);
    await set(newQuizRef, newQuizData);

    alert('성공적으로 Firebase 서버에 퀴즈가 출제되었습니다!');
    document.getElementById('modal-create-quiz').classList.add('hidden');
    document.getElementById('form-create-quiz').reset();
    loadQuizzesFromDB();
  } catch (err) {
    console.error("Firebase DB 저장 오류:", err);
    alert('데이터 저장 중 오류가 발생했습니다: ' + err.message);
  }
});

// Load Quizzes
async function loadQuizzesFromDB() {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'quizzes'));

    if (snapshot.exists()) {
      const data = snapshot.val();
      const quizList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      renderChapterCards(quizList);
    } else {
      renderChapterCards(getSampleQuizzes());
    }
  } catch (error) {
    console.warn("Firebase Fetch Error, using sample data:", error);
    renderChapterCards(getSampleQuizzes());
  }
}

function renderChapterCards(quizzes) {
  chapterListContainer.innerHTML = '';
  if (!quizzes || quizzes.length === 0) {
    chapterListContainer.innerHTML = `<p class="col-span-full text-center text-slate-400 py-8">등록된 퀴즈가 없습니다.</p>`;
    return;
  }

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

    card.querySelector('.btn-start-quiz').addEventListener('click', () => {
      if (!currentUser) {
        alert('퀴즈에 응시하려면 로그인이 필요합니다.');
        document.getElementById('modal-auth').classList.remove('hidden');
        return;
      }
      startQuiz(quiz);
    });

    chapterListContainer.appendChild(card);
  });
}

function startQuiz(quiz) {
  currentActiveQuiz = quiz;
  document.getElementById('solve-chapter-title').textContent = quiz.chapter;
  document.getElementById('solve-quiz-title').textContent = quiz.title;

  const questionsContainer = document.getElementById('questions-container');
  questionsContainer.innerHTML = '';

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
    questionsContainer.appendChild(qEl);
  });

  viewDashboard.classList.add('hidden');
  viewQuizSolve.classList.remove('hidden');
  viewQuizResult.classList.add('hidden');
}

document.getElementById('form-solve-quiz').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentActiveQuiz) return;

  let score = 0;
  const totalQuestions = currentActiveQuiz.questions.length;
  const feedbackHTML = [];

  currentActiveQuiz.questions.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="question_${idx}"]:checked`);
    const userAns = selected ? parseInt(selected.value, 10) : -1;
    const isCorrect = (userAns === q.answer);

    if (isCorrect) score += 100 / totalQuestions;

    feedbackHTML.push(`
      <div class="p-4 rounded-lg border ${isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}">
        <div class="flex items-center gap-2 mb-1">
          <i class="fa-solid ${isCorrect ? 'fa-circle-check text-emerald-600' : 'fa-circle-xmark text-rose-600'}"></i>
          <span class="font-bold text-sm text-slate-800">Q${idx + 1}. ${q.title}</span>
        </div>
        <p class="text-xs text-slate-600 mt-1">선택 답안: ${q.options[userAns] || '미선택'} | 정답: ${q.options[q.answer]}</p>
        ${q.explanation ? `<p class="text-xs text-slate-500 mt-2 bg-white/70 p-2 rounded">💡 해설: ${q.explanation}</p>` : ''}
      </div>
    `);
  });

  const finalScore = Math.round(score);
  document.getElementById('result-score').textContent = finalScore;
  document.getElementById('result-feedback-container').innerHTML = feedbackHTML.join('');

  if (currentUser) {
    try {
      const resultRef = ref(db, `results/${currentUser.username}`);
      await push(resultRef, {
        quizTitle: currentActiveQuiz.title,
        score: finalScore,
        submittedAt: Date.now()
      });
    } catch (err) {
      console.warn("결과 기록 저장 실패:", err);
    }
  }

  viewQuizSolve.classList.add('hidden');
  viewQuizResult.classList.remove('hidden');
});

async function loadUserStats() {
  if (!currentUser) return;
  try {
    const resultRef = ref(db, `results/${currentUser.username}`);
    const snapshot = await get(resultRef);
    if (snapshot.exists()) {
      const records = Object.values(snapshot.val());
      const totalTrials = records.length;
      const avgScore = Math.round(records.reduce((acc, cur) => acc + cur.score, 0) / totalTrials);

      document.getElementById('stat-total-trials').textContent = `${totalTrials}회`;
      document.getElementById('stat-avg-score').textContent = `${avgScore}점`;
      document.getElementById('stat-completed-chapters').textContent = `${new Set(records.map(r => r.quizTitle)).size}개`;
    }
  } catch (err) {
    console.warn("통계 조회 실패:", err);
  }
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
    chapter: '제 1장. Firebase 기초',
    title: 'Realtime Database 샘플 점검',
    createdAt: Date.now(),
    author: '운영진',
    questions: [{
      title: 'Firebase Realtime Database의 데이터 저장 형식은 무엇일까요?',
      options: ['JSON 트리', '관계형 테이블', 'CSV 파일', 'XML 데이터'],
      answer: 0,
      explanation: 'Realtime Database는 하나의 거대한 JSON 데이터 트리 형식으로 데이터를 저장합니다.'
    }]
  }];
}
