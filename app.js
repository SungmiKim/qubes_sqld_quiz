// app.js
(function () {
  const STORAGE_KEY = 'quiz_progress_v1';

  // ---- 유틸 ----
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { solvedIds: [], currentId: null };
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.solvedIds)) return { solvedIds: [], currentId: null };
      return {
        solvedIds: parsed.solvedIds,
        currentId: parsed.currentId ?? null,
      };
    } catch (e) {
      return { solvedIds: [], currentId: null };
    }
  }

  function saveProgress(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetProgress() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ---- 상태 ----
  let state = loadProgress();
  let currentQuestion = null;
  let currentShuffledChoices = []; // [{ text, isCorrect }]
  let answered = false;

  // ---- DOM ----
  const $qNo = $('#qNo');
  const $qText = $('#qText');
  const $choices = $('#choices');
  const $resultBox = $('#resultBox');
  const $explanationBox = $('#explanationBox');
  const $nextBtn = $('#nextBtn');
  const $progressText = $('#progressText');
  const $endScreen = $('#endScreen');
  const $quizScreen = $('#quizScreen');
  const $passageBox = $('#passageBox');

  // ---- 로직 ----
  function getUnsolvedQuestions() {
    const solvedSet = new Set(state.solvedIds);
    return QUIZ_DATA.filter((q) => !solvedSet.has(q.id));
  }

  function pickQuestion() {
    const unsolved = getUnsolvedQuestions();

    if (unsolved.length === 0) {
      showEnd();
      return null;
    }

    // 이어하기: currentId가 있고 아직 안 풀었으면 그 문제 먼저
    if (state.currentId) {
      const found = unsolved.find((q) => q.id === state.currentId);
      if (found) return found;
    }

    // 아니면 랜덤 선택
    const q = unsolved[Math.floor(Math.random() * unsolved.length)];
    state.currentId = q.id;
    saveProgress(state);
    return q;
  }

  function renderQuestion(q) {
    currentQuestion = q;
    answered = false;
    $nextBtn.prop('disabled', true);

    // 진행 표시
    const solvedCount = state.solvedIds.length;
    const total = QUIZ_DATA.length;
    $progressText.text(`${solvedCount}/${total} 완료`);

    // 화면 초기화
    $resultBox.removeClass('ok no').text('');
    $explanationBox.addClass('hidden').html('');

    // 문제 텍스트
    $qNo.text(`Q${solvedCount + 1}`);
    $qText.text(q.question);

    if (q.passage && String(q.passage).trim() !== '') {
      $passageBox.removeClass('hidden').html(q.passage);
    } else {
      $passageBox.addClass('hidden').html('');
    }

    // 보기 셔플: 정답 여부 매핑
    const packed = q.choices.map((text, idx) => ({
      text,
      isCorrect: idx + 1 === q.answer,
    }));

    currentShuffledChoices = shuffle(packed);

    // 보기 렌더
    $choices.empty();
    currentShuffledChoices.forEach((c, i) => {
      const choiceNumber = i + 1; // 사용자에게는 1~4로 보여줌
      const $btn = $(`
        <button class="choice" type="button" data-idx="${i}">
          <span class="num">${choiceNumber}</span>
          <span class="label"></span>
        </button>
      `);
      $btn.find('.label').text(c.text);
      $choices.append($btn);
    });
  }

  function lockChoices() {
    $('.choice').prop('disabled', true).addClass('locked');
  }

  function markSolved() {
    if (!state.solvedIds.includes(currentQuestion.id)) {
      state.solvedIds.push(currentQuestion.id);
    }
    state.currentId = null; // 다음엔 새로운 문제 뽑기
    saveProgress(state);
  }

  function showEnd() {
    $quizScreen.addClass('hidden');
    $endScreen.removeClass('hidden');
    $progressText.text(`${QUIZ_DATA.length}/${QUIZ_DATA.length} 완료`);
  }

  function showQuiz() {
    $endScreen.addClass('hidden');
    $quizScreen.removeClass('hidden');
  }

  // ---- 이벤트 ----
  $choices.on('click', '.choice', function () {
    if (answered) return;

    const idx = Number($(this).data('idx'));
    const picked = currentShuffledChoices[idx];

    answered = true;
    lockChoices();
    $(this).addClass('picked');

    // 정답 번호(1~4) 알려주기: 셔플된 배열에서 정답의 위치 찾기
    const correctIdx = currentShuffledChoices.findIndex((x) => x.isCorrect);
    const correctNumber = correctIdx + 1;

    if (picked.isCorrect) {
      $resultBox.addClass('ok').removeClass('no').text('정답 ✅');
    } else {
      $resultBox.addClass('no').removeClass('ok').text(`오답 ❌ (정답은 ${correctNumber}번)`);
      // 정답 강조
      $(`.choice[data-idx="${correctIdx}"]`).addClass('correct');
    }

    // 해설 표시(항상 표시)
    $explanationBox
      .removeClass('hidden')
      .html(
        `<div class="ex-title">해설</div><div class="ex-body">${currentQuestion.explanation}</div>`,
      );

    // 푼 문제 처리 + 다음 버튼 활성화
    markSolved();
    $nextBtn.prop('disabled', false);
  });

  $nextBtn.on('click', function () {
    const q = pickQuestion();
    if (!q) return;
    showQuiz();
    renderQuestion(q);
  });

  $('#resetBtn').on('click', function () {
    const ok = confirm('진행상태를 초기화할까요?');
    if (!ok) return;
    resetProgress();
    state = loadProgress();
    const q = pickQuestion();
    showQuiz();
    if (q) renderQuestion(q);
  });

  $('#restartBtn').on('click', function () {
    resetProgress();
    state = loadProgress();
    const q = pickQuestion();
    showQuiz();
    if (q) renderQuestion(q);
  });

  // ---- 시작 ----
  $(function () {
    // 기존: window.QUIZ_DATA 검사 → 삭제/교체
    if (typeof QUIZ_DATA === 'undefined' || !Array.isArray(QUIZ_DATA) || QUIZ_DATA.length === 0) {
      alert('data.js에 QUIZ_DATA가 없습니다.');
      return;
    }

    const unsolved = getUnsolvedQuestions();
    if (unsolved.length === 0) {
      showEnd();
      return;
    }

    const q = pickQuestion();
    showQuiz();
    if (q) renderQuestion(q);
  });
})();
