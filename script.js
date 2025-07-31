const floorPlan = document.getElementById('floorPlan');
const locationName = document.getElementById('currentLocationName');
const btn = document.getElementById('startNavBtn');

let startNode = null;
let endNode = null;
let allNodes = [];
let allEdges = [];
let studios = [];
let selectedStudios = [];


fetch('map-floor1.json')
  .then(res => res.json())
  .then(data => {
    studios = data.studios;
    allNodes = data.nodes;
    allEdges = data.edges;
    renderDoors(data.doors);
    renderWalls(data.walls);
    renderStudios(data.studios);
    renderNodes(data.nodes);
  });


  function renderStudios(studios) {
    studios.forEach(s => {
      const el = document.createElement("div");
      el.className = "studio";
      el.dataset.id = s.id;              
      el.style.left = s.x + "%";
      el.style.top = s.y + "%";
      el.textContent = s.id;
  
      floorPlan.appendChild(el);
      el.addEventListener('click', () => handleStudioClick(el));
      floorPlan.appendChild(el); // 
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

function renderDoors(doors) {
  doors.forEach(d => {
    const door = document.createElement('div');
    door.className = `door-container ${d.group}`;  // top / bottom 클래스 추가
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


function renderWalls(walls) {
  walls.forEach(w => {
    const el = document.createElement('div');
    el.className = 'wall';
    el.style.left = w.x + '%';
    el.style.top = w.y + '%';
    el.style.width = w.width + '%';
    el.style.height = w.height + '%';
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


function handleStudioClick(studioEl) {
  // 2개 선택되어 있으면 초기화
  if (!startNode) {
    startNode = id;
    studioEl.classList.add('start-selected');   // 출발지 선택 클래스
    locationName.textContent = id;
  } else if (!endNode) {
    endNode = id;
    studioEl.classList.add('end-selected');     // 도착지 선택 클래스
  }
  


  if (!selectedStudios.includes(studioEl)) {
    studioEl.classList.add('start-selected');
    selectedStudios.push(studioEl);

    const id = studioEl.dataset.id;
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
  // 1. 아무것도 선택 안 됐을 때
  if (!startNode) {
    btn.disabled = true;
    btn.style.background = '#999999';
    btn.textContent = "출발지를 선택해주세요";

  // 2. 출발지만 선택됐을 때
  } else if (startNode && !endNode) {
    btn.disabled = true;
    btn.style.background = '#999999';
    btn.textContent = "도착지를 선택해주세요";

  // 3. 출발지 + 도착지 다 선택됐을 때
  } else if (startNode && endNode) {
    btn.disabled = false;
    btn.style.background = "linear-gradient(90deg, #195895, #001c58)";
    btn.textContent = "스튜디오 찾기";
  }
}


btn.addEventListener('click', async () => {
  if (startNode && endNode) {
    const pathIds = calculatePath(startNode, endNode);

    // 캐릭터 초기화 (사라지게 처리)
    const char = document.getElementById('character');
    char.style.display = 'none';

    // 출발지 좌표로 바로 이동
    const pos = getPosition(startNode);
    if (pos) {
      const planWidth = floorPlan.clientWidth;
      const planHeight = floorPlan.clientHeight;
      char.style.left = (pos.x / 100) * planWidth + 'px';
      char.style.top = (pos.y / 100) * planHeight + 'px';
    }

    // 빨간 경로 그리기
    drawPath(pathIds);

    // 캐릭터 다시 나타나기
    char.style.display = 'block';

    // 경로 따라 이동
    await moveCharacter(pathIds);
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

function clearPath() {
  const svg = document.getElementById('pathOverlay');
  svg.querySelectorAll('path.route, path.arrowAnim').forEach(p => p.remove());
}

function handleStudioClick(studioEl) {
  const id = studioEl.dataset.id;
  const char = document.getElementById('character');

  // ✅ 이미 출발지로 선택된 경우 → 해제
  if (startNode === id && !endNode) {
    studioEl.classList.remove('start-selected', 'blinking');
    startNode = null;
    selectedStudios = [];
    locationName.textContent = '-';
    document.getElementById('destinationLocationName').textContent = '-';
    clearPath();

    // 캐릭터 숨김
    char.style.display = 'none';

    updateBtn();
    return;
  }

  // ✅ 출발지와 도착지 모두 선택된 상태 → 초기화
  if (selectedStudios.length === 2) {
    selectedStudios.forEach(el => {
      el.classList.remove('start-selected', 'end-selected', 'blinking');
      el.style.animation = '';
    });
    selectedStudios = [];
    startNode = null;
    endNode = null;
    locationName.textContent = '-';
    document.getElementById('destinationLocationName').textContent = '-';
    clearPath();

    // 캐릭터 숨김
    char.style.display = 'none';

    updateBtn();
  }

  // ✅ 새 선택
  if (!selectedStudios.includes(studioEl)) {
    if (!startNode) {
      // 출발지 선택
      studioEl.classList.add('start-selected');
      startNode = id;
      locationName.textContent = id;

      // 캐릭터 출발 위치에 표시
      const pos = getPosition(id);
      if (pos) {
        const planWidth = floorPlan.clientWidth;
        const planHeight = floorPlan.clientHeight;
        char.style.left = (pos.x / 100) * planWidth + 'px';
        char.style.top = (pos.y / 100) * planHeight + 'px';
        char.style.display = 'block';   // ✅ 여기서 반드시 표시
      }
    } else if (!endNode) {
      // 도착지 선택
      studioEl.classList.add('end-selected');
      endNode = id;
      document.getElementById('destinationLocationName').textContent = id;

      addBlinkingClassSync(selectedStudios.concat(studioEl));
    }

    selectedStudios.push(studioEl);
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

    // 퍼센트를 실제 px로 변환
    const targetX = (pos.x / 100) * planWidth;
    const targetY = (pos.y / 100) * planHeight;

    await animateMove(char, targetX, targetY, 600); // 하나씩 이동
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
      const t = Math.min((now - startTime) / duration, 1); // 0~1
      el.style.left = startX + dx * t + 'px';
      el.style.top = startY + dy * t + 'px';

      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }

    requestAnimationFrame(step);
  });
}



function addBlinkingClassSync(elements) {
  elements.forEach(el => {
    el.classList.remove('blinking');
  });

  // 강제로 리플로우 발생 → 애니메이션 동기화
  void document.body.offsetWidth;

  elements.forEach(el => {
    el.classList.add('blinking');
  });
}


function scaleApp() {
  const container = document.querySelector('.app-container');
  const scale = Math.min(window.innerWidth / 360, 1);
  container.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', scaleApp);
window.addEventListener('load', scaleApp);
