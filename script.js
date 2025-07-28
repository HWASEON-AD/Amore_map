const floorPlan = document.getElementById('floorPlan');
const locationName = document.getElementById('currentLocationName');
const btn = document.getElementById('startNavBtn');

let startNode = null;
let endNode = null;
let allNodes = [];
let allEdges = [];
let studios = [];
let selectedStudios = []; // 선택된 스튜디오 DOM 관리용

fetch('map-floor1.json')
  .then(res => res.json())
  .then(data => {
    studios = data.studios;
    allNodes = data.nodes;
    allEdges = data.edges;

    renderStudios(data.studios);
    renderWalls(data.walls);
    renderNodes(data.nodes);
    renderDoors(data.doors);
  });

function renderStudios(studios) {
  studios.forEach(s => {
    const el = document.createElement('div');
    el.className = `studio ${s.type}`;
    el.dataset.id = s.id;
    el.dataset.x = s.x;
    el.dataset.y = s.y;
    el.style.left = s.x + '%';
    el.style.top = s.y + '%';
    el.textContent = s.id;
    el.addEventListener('click', () => handleStudioClick(el));
    floorPlan.appendChild(el);
  });

  
}

function renderDoors(doors) {
  doors.forEach(d => {
    const el = document.createElement('div');
    el.className = 'door';
    el.style.left = d.x + '%';
    el.style.top = d.y + '%';

    /*
    const label = document.createElement('div');
    label.className = 'door-label';
    label.textContent = d.id;
    el.appendChild(label);
    */

    floorPlan.appendChild(el);
  });
}


function renderNodes(nodes) {
  nodes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'node';
    el.style.left = n.x + '%';
    el.style.top = n.y + '%';
    floorPlan.appendChild(el);
  });
}

function renderWalls(walls) {
  const svg = document.getElementById('pathOverlay');
  walls.forEach(w => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', w.x1 + '%');
    line.setAttribute('y1', w.y1 + '%');
    line.setAttribute('x2', w.x2 + '%');
    line.setAttribute('y2', w.y2 + '%');
    line.setAttribute('stroke', '#555');
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  });
}

function handleStudioClick(studioEl) {
  // 2개 선택되어 있으면 초기화
  if (selectedStudios.length === 2) {
    selectedStudios.forEach(el => el.classList.remove('selected'));
    selectedStudios = [];
    startNode = null;
    endNode = null;
    updateBtn();
  }

  // 새 선택
  if (!selectedStudios.includes(studioEl)) {
    studioEl.classList.add('selected');
    selectedStudios.push(studioEl);

    const id = studioEl.dataset.id; // 스튜디오 id 자체를 경로 탐색에 사용
    if (!startNode) {
      startNode = id;
      locationName.textContent = id;
    } else if (!endNode) {
      endNode = id;
    }
    updateBtn();
  }
}

function updateBtn() {
  if (startNode && endNode) {
    btn.disabled = false;
    btn.classList.add('enabled');
    btn.textContent = '경로 안내 시작';
  } else {
    btn.disabled = true;
    btn.classList.remove('enabled');
    btn.textContent = '목적지를 선택해주세요';
  }
}

btn.addEventListener('click', async () => {
  if (startNode && endNode) {
    const pathIds = calculatePath(startNode, endNode);
    drawPath(pathIds);       // 빨간 경로 그리기
    await moveCharacter(pathIds); // 경로 따라 이동
  }
});


function calculatePath(startId, endId) {
  const graph = {};
  allEdges.forEach(e => {
    if (!graph[e.from]) graph[e.from] = [];
    if (!graph[e.to]) graph[e.to] = [];
    graph[e.from].push(e.to);
    graph[e.to].push(e.from);
  });

  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];
    if (node === endId) {
      return path; // 이제는 ID 배열 그대로 반환
    }
    for (let next of graph[node] || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

// 스튜디오나 노드 ID로 좌표를 찾아주는 헬퍼
function getPosition(id) {
  // 스튜디오에서 찾기
  let pos = studios.find(s => s.id === id);
  if (pos) return { x: pos.x, y: pos.y };

  // 노드에서 찾기
  pos = allNodes.find(n => n.id === id);
  if (pos) return { x: pos.x, y: pos.y };

  console.warn('좌표를 찾을 수 없음:', id);
  return null;
}


function drawPath(pathIds) {
  const svg = document.getElementById('pathOverlay');
  svg.querySelectorAll('path.route, path.arrowAnim').forEach(p => p.remove());

  // get bounding box of floorPlan
  const planWidth = floorPlan.clientWidth;
  const planHeight = floorPlan.clientHeight;

  let d = '';
  pathIds.forEach((id, idx) => {
    const pos = getPosition(id);
    if (!pos) return;

    // 퍼센트를 실제 px로 변환
    const pxX = (pos.x / 100) * planWidth;
    const pxY = (pos.y / 100) * planHeight;

    if (idx === 0) {
      d += `M${pxX},${pxY} `;
    } else {
      d += `L${pxX},${pxY} `;
    }
  });

  // 경로 길이 측정
  const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tempPath.setAttribute('d', d);
  svg.appendChild(tempPath);
  const length = tempPath.getTotalLength();
  svg.removeChild(tempPath);

  // 메인 선
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
  svg.appendChild(mainPath);

  setTimeout(() => {
    mainPath.style.transition = 'stroke-dashoffset 2s ease-out';
    mainPath.style.strokeDashoffset = '0';
  }, 50);

}


function handleStudioClick(studioEl) {
  if (selectedStudios.length === 2) {
    selectedStudios.forEach(el => el.classList.remove('selected'));
    selectedStudios = [];
    startNode = null;
    endNode = null;
    updateBtn();
  }

  if (!selectedStudios.includes(studioEl)) {
    studioEl.classList.add('selected');
    selectedStudios.push(studioEl);

    const id = studioEl.dataset.id;
    if (!startNode) {
      startNode = id;
      locationName.textContent = id;

      // 캐릭터를 그 위치로 이동시키고 보여주기
      const pos = getPosition(id);
      const planWidth = floorPlan.clientWidth;
      const planHeight = floorPlan.clientHeight;
      const char = document.getElementById('character');
      char.style.left = (pos.x / 100) * planWidth + 'px';
      char.style.top = (pos.y / 100) * planHeight + 'px';
      char.style.display = 'block';
    } else if (!endNode) {
      endNode = id;
    }
    updateBtn();
  }
}


async function moveCharacter(pathIds) {
  const char = document.getElementById('character');
  const planWidth = floorPlan.clientWidth;
  const planHeight = floorPlan.clientHeight;

  for (let i = 0; i < pathIds.length; i++) {
    const pos = getPosition(pathIds[i]);
    if (!pos) continue;

    const targetX = (pos.x / 100) * planWidth;
    const targetY = (pos.y / 100) * planHeight;

    await animateMove(char, targetX, targetY, 600); // 각 구간 0.6초
  }
}

function animateMove(el, targetX, targetY, duration) {
  return new Promise(resolve => {
    const startX = el.offsetLeft;
    const startY = el.offsetTop;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const startTime = performance.now();

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      el.style.left = startX + dx * t + 'px';
      el.style.top = startY + dy * t + 'px';
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}
