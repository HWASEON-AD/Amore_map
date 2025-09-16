// ====== 전역 DOM 참조 ======
const floorPlan = document.getElementById('floorPlan');
const locationName = document.getElementById('currentLocationName');              // 출발지 표시
const destinationName = document.getElementById('destinationLocationName');       // 도착지 표시
const btn = document.getElementById('startNavBtn');                               // "스튜디오 찾기" 버튼
const svgOverlay = document.getElementById('pathOverlay');                        // SVG 경로 오버레이
const charEl = document.getElementById('character');                              // 이동 캐릭터

// ====== 상태값 ======
let startNode = null;             // 출발지 id (스튜디오 또는 노드 id)
let endNode = null;               // 도착지 id
let allNodes = [];                // [{id, x, y}, ...]  (노드 좌표/식별자)
let allEdges = [];                // [{from, to}, ...]  (노드 간 연결)
let studios = [];                 // [{id, x, y}, ...]  (스튜디오 좌표/식별자)
let selectedStudios = [];         // 선택된 스튜디오 DOM 엘리먼트 0~2개

// ====== 초기 데이터 로드 및 렌더링 ======
fetch('map-floor1.json')
  .then(res => res.json())
  .then(data => {
    // 데이터 바인딩
    studios = data.studios || [];
    allNodes = data.nodes || [];
    allEdges = data.edges || [];

    // 렌더링
    renderDoors(data.doors || []);
    renderWalls(data.walls || []);
    renderStudios(studios);
    renderNodes(allNodes);

    // 초기 버튼 상태
    updateBtn();

    // 초기 축척 적용
    scaleApp();
  })
  .catch(err => {
    console.error('[ERROR] map-floor1.json 로드 실패:', err);
  });

/******************************************************
 *  렌더링 계층
 ******************************************************/

/**
 * 스튜디오(클릭 대상) 렌더링
 * - 각 스튜디오는 .studio 클래스를 가지며 좌표는 % 단위로 배치
 * - 클릭 이벤트: handleStudioClick
 */
function renderStudios(studiosArr) {
  if (!floorPlan) return;

  studiosArr.forEach(s => {
    const el = document.createElement('div');
    el.className = 'studio';
    el.dataset.id = s.id;
    el.style.left = s.x + '%';
    el.style.top = s.y + '%';
    el.textContent = s.id;

    el.addEventListener('click', () => handleStudioClick(el));

    // ⚠️ 기존 코드에는 동일 엘리먼트를 두 번 append하는 버그가 있었음 → 단일 append만 수행
    floorPlan.appendChild(el);
  });
}

/**
 * 보조 노드(경로 탐색용 시각화) 렌더링
 */
function renderNodes(nodesArr) {
  if (!floorPlan) return;

  nodesArr.forEach(n => {
    const el = document.createElement('div');
    el.className = 'node';
    el.style.left = n.x + '%';
    el.style.top = n.y + '%';
    floorPlan.appendChild(el);
  });
}

/**
 * 문(door) 렌더링
 * - group(top/bottom/left/right 등) 클래스 추가 가정
 * - 양쪽 패널을 가진 도어 구조 (.door-panel.left / .door-panel.right)
 */
function renderDoors(doorsArr) {
  if (!floorPlan) return;

  doorsArr.forEach(d => {
    const door = document.createElement('div');
    door.className = `door-container ${d.group || ''}`.trim();
    door.dataset.id = d.id;
    door.style.left = d.x + '%';
    door.style.top = d.y + '%';
    door.style.width = d.width + '%';
    door.style.height = d.height + '%';

    const leftPanel = document.createElement('div');
    leftPanel.className = 'door-panel left';

    const rightPanel = document.createElement('div');
    rightPanel.className = 'door-panel right';

    door.appendChild(leftPanel);
    door.appendChild(rightPanel);
    floorPlan.appendChild(door);
  });
}

/**
 * 벽(wall) 렌더링
 * - 엘리베이터 타입은 'E' 라벨 추가
 */
function renderWalls(wallsArr) {
  if (!floorPlan) return;

  wallsArr.forEach(w => {
    const el = document.createElement('div');
    el.className = 'wall';
    el.style.left = w.x + '%';
    el.style.top = w.y + '%';
    el.style.width = w.width + '%';
    el.style.height = w.height + '%';
    // 중심 정렬
    el.style.transform = 'translate(-50%, -50%)';

    if (w.type === 'elevator') {
      const label = document.createElement('span');
      label.className = 'wall-label';
      label.textContent = 'E';
      el.appendChild(label);
    }
    floorPlan.appendChild(el);
  });
}

/******************************************************
 *  선택/버튼 상태 로직
 ******************************************************/

/**
 * 스튜디오 클릭 처리 (단일 정의)
 * - 0개 → 출발지로 선택
 * - 1개(출발지만 선택) → 도착지로 선택
 * - 2개(출발/도착 모두 선택)인 상태에서 또 클릭 → 전체 초기화 후 새 선택 시작
 * - 출발지만 선택된 상태에서 같은 출발지 다시 클릭 → 해제
 */
function handleStudioClick(studioEl) {
  const id = studioEl.dataset.id;

  // 1) 출발지만 선택된 상태에서 같은 요소를 다시 클릭 → 출발지 해제
  if (startNode === id && !endNode) {
    // 시각 효과 해제
    studioEl.classList.remove('start-selected', 'blinking');

    // 상태 초기화
    startNode = null;
    selectedStudios = [];
    if (locationName) locationName.textContent = '-';
    if (destinationName) destinationName.textContent = '-';

    // 경로/캐릭터 초기화
    clearPath();
    hideCharacter();

    updateBtn();
    return;
  }

  // 2) 이미 두 개 선택되어 있는 상태(출발/도착 완료) → 전체 초기화 후 새 선택으로 처리
  if (selectedStudios.length === 2) {
    resetSelectionsAndPath();
  }

  // 3) 새 선택 로직
  if (!selectedStudios.includes(studioEl)) {
    // 출발지 미선택 → 출발지로 설정
    if (!startNode) {
      studioEl.classList.add('start-selected');
      startNode = id;
      if (locationName) locationName.textContent = id;

      // 캐릭터 출발 위치 표시
      const pos = getPosition(id);
      if (pos) {
        placeCharacterAtPercentPosition(pos.x, pos.y);
        showCharacter();
      }
    }
    // 출발지는 있고, 도착지 미선택 → 도착지로 설정
    else if (!endNode) {
      studioEl.classList.add('end-selected');
      endNode = id;
      if (destinationName) destinationName.textContent = id;

      // 출발/도착 점 Blink 동기화
      addBlinkingClassSync(selectedStudios.concat(studioEl));
    }

    selectedStudios.push(studioEl);
    updateBtn();
  }
}

/**
 * 버튼 상태/문구 갱신
 */
function updateBtn() {
  if (!btn) return;

  // 아무것도 선택 안 됨
  if (!startNode) {
    btn.disabled = true;
    btn.style.background = '#999999';
    btn.textContent = '출발지를 선택해주세요';
    return;
  }
  // 출발지만 선택됨
  if (startNode && !endNode) {
    btn.disabled = true;
    btn.style.background = '#999999';
    btn.textContent = '도착지를 선택해주세요';
    return;
  }
  // 출발지+도착지 선택됨
  if (startNode && endNode) {
    btn.disabled = false;
    btn.style.background = 'linear-gradient(90deg, #195895, #001c58)';
    btn.textContent = '스튜디오 찾기';
    return;
  }
}

/**
 * 선택/경로/표시 전체 초기화
 */
function resetSelectionsAndPath() {
  // 시각 효과 모두 제거
  selectedStudios.forEach(el => {
    el.classList.remove('start-selected', 'end-selected', 'blinking');
    // 혹시 인라인 애니메이션이 있다면 초기화
    el.style.animation = '';
  });
  selectedStudios = [];

  // 상태 초기화
  startNode = null;
  endNode = null;

  if (locationName) locationName.textContent = '-';
  if (destinationName) destinationName.textContent = '-';

  clearPath();
  hideCharacter();

  updateBtn();
}

/******************************************************
 *  경로 계산/그리기/이동
 ******************************************************/

/**
 * BFS로 최단 경로(노드 id 배열)를 계산
 * @param {string} startId
 * @param {string} endId
 * @returns {string[]} pathIds
 */
function calculatePath(startId, endId) {
  // 인접 리스트 구성
  const graph = {};
  allEdges.forEach(e => {
    if (!graph[e.from]) graph[e.from] = [];
    if (!graph[e.to]) graph[e.to] = [];
    graph[e.from].push(e.to);
    graph[e.to].push(e.from);
  });

  // BFS
  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === endId) {
      return path; // ID 배열 그대로 반환
    }
    for (let next of (graph[node] || [])) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

/**
 * ID(스튜디오/노드)로 좌표(%) 조회
 * @param {string} id
 * @returns {{x:number, y:number} | null}
 */
function getPosition(id) {
  // 1) 스튜디오에서 찾기
  let pos = studios.find(s => s.id === id);
  if (pos) return { x: pos.x, y: pos.y };

  // 2) 노드에서 찾기
  pos = allNodes.find(n => n.id === id);
  if (pos) return { x: pos.x, y: pos.y };

  console.warn('[WARN] 좌표를 찾을 수 없음:', id);
  return null;
}

/**
 * SVG 경로 그리기(애니메이션 포함)
 * - path.route: 메인 경로(적색)
 * - path.arrowAnim: (옵션) 화살표/이펙트용 (현재는 미사용)
 */
function drawPath(pathIds) {
  if (!svgOverlay || !floorPlan) return;

  // 기존 경로 제거
  svgOverlay.querySelectorAll('path.route, path.arrowAnim').forEach(p => p.remove());

  const planWidth = floorPlan.clientWidth;
  const planHeight = floorPlan.clientHeight;

  // d 속성 작성 (px 단위)
  let d = '';
  pathIds.forEach((id, idx) => {
    const pos = getPosition(id);
    if (!pos) return;

    const pxX = (pos.x / 100) * planWidth;
    const pxY = (pos.y / 100) * planHeight;

    d += (idx === 0) ? `M${pxX},${pxY} ` : `L${pxX},${pxY} `;
  });

  // 경로 길이 계산을 위해 임시 path
  const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tempPath.setAttribute('d', d);
  svgOverlay.appendChild(tempPath);
  const length = tempPath.getTotalLength();
  svgOverlay.removeChild(tempPath);

  // 메인 경로 path
  const mainPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  mainPath.setAttribute('d', d);
  mainPath.setAttribute('stroke', 'red');
  mainPath.setAttribute('stroke-width', '3');
  mainPath.setAttribute('fill', 'none');
  mainPath.setAttribute('stroke-linecap', 'round');
  mainPath.setAttribute('stroke-linejoin', 'round');
  mainPath.classList.add('route');
  mainPath.style.strokeDasharray = length;
  mainPath.style.strokeDashoffset = length;
  svgOverlay.appendChild(mainPath);

  // 그려지는 애니메이션
  setTimeout(() => {
    mainPath.style.transition = 'stroke-dashoffset 2s ease-out';
    mainPath.style.strokeDashoffset = '0';
  }, 50);
}

/**
 * SVG 경로 초기화
 */
function clearPath() {
  if (!svgOverlay) return;
  svgOverlay.querySelectorAll('path.route, path.arrowAnim').forEach(p => p.remove());
}

/**
 * 캐릭터가 경로를 따라 한 점씩 이동
 * - 각 구간 duration(ms) 고정
 */
async function moveCharacter(pathIds, segmentDuration = 600) {
  if (!charEl || !floorPlan) return;

  const planWidth = floorPlan.clientWidth;
  const planHeight = floorPlan.clientHeight;

  for (let i = 0; i < pathIds.length; i++) {
    const pos = getPosition(pathIds[i]);
    if (!pos) continue;

    const targetX = (pos.x / 100) * planWidth;
    const targetY = (pos.y / 100) * planHeight;

    // 한 구간 이동
    await animateMove(charEl, targetX, targetY, segmentDuration);
  }
}

/**
 * 단일 구간 이동 애니메이션
 * - requestAnimationFrame 기반 보간
 */
function animateMove(el, targetX, targetY, duration) {
  return new Promise(resolve => {
    const startX = el.offsetLeft;
    const startY = el.offsetTop;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const startTime = performance.now();

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1); // 0~1
      el.style.left = (startX + dx * t) + 'px';
      el.style.top = (startY + dy * t) + 'px';

      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }

    requestAnimationFrame(step);
  });
}

/******************************************************
 *  유틸리티
 ******************************************************/

/**
 * 출발/도착 스튜디오에 동기화된 깜빡임 효과 부여
 * - CSS: .blinking 애니메이션 미리 정의 필요
 */
function addBlinkingClassSync(elements) {
  elements.forEach(el => el.classList.remove('blinking'));

  // 강제 리플로우 → 애니메이션 재시작 동기화
  void document.body.offsetWidth;

  elements.forEach(el => el.classList.add('blinking'));
}

/**
 * 캐릭터를 % 좌표 기반으로 즉시 배치 (floorPlan의 현재 픽셀 크기 고려)
 */
function placeCharacterAtPercentPosition(xPercent, yPercent) {
  if (!charEl || !floorPlan) return;

  const planWidth = floorPlan.clientWidth;
  const planHeight = floorPlan.clientHeight;

  charEl.style.left = (xPercent / 100) * planWidth + 'px';
  charEl.style.top = (yPercent / 100) * planHeight + 'px';
}

/**
 * 캐릭터 표시/숨김
 */
function showCharacter() {
  if (charEl) charEl.style.display = 'block';
}
function hideCharacter() {
  if (charEl) charEl.style.display = 'none';
}

/**
 * 앱 축소(모바일 가상 프레임 360px 기준)
 * - .app-container에 transform: scale(...) 적용
 */
function scaleApp() {
  const container = document.querySelector('.app-container');
  if (!container) return;

  const scale = Math.min(window.innerWidth / 360, 1);
  container.style.transform = `scale(${scale})`;
}

/******************************************************
 *  이벤트 바인딩
 ******************************************************/

/**
 * "스튜디오 찾기" 클릭: 경로 계산 → 경로 그리기 → 캐릭터 이동
 */
btn?.addEventListener('click', async () => {
  if (!startNode || !endNode) return;

  // 경로 계산
  const pathIds = calculatePath(startNode, endNode);

  // 캐릭터 숨김 후 출발지 위치로 순간이동
  hideCharacter();
  const pos = getPosition(startNode);
  if (pos) placeCharacterAtPercentPosition(pos.x, pos.y);

  // 경로 그리기
  drawPath(pathIds);

  // 캐릭터 표시 후 이동 시작
  showCharacter();
  await moveCharacter(pathIds);
});

/**
 * 반응형 축소 처리
 */
window.addEventListener('resize', scaleApp);
window.addEventListener('load', scaleApp);
