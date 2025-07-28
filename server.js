const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000; // Render 등 클라우드 환경 지원

// 현재 폴더를 정적(static)으로 서비스
app.use(express.static(__dirname));
app.use(cors());

// 루트('/) 접속 시 index.html로 리다이렉트
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// /DF/index.html로 들어오면 /index.html로 리다이렉트 (쿼리스트링 유지)
app.get('/DF/index.html', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect('/index.html' + query);
});

// 서버 실행
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 서버 실행 중: http://127.0.0.1:${PORT}/index.html`);
  console.log(`📱 같은 Wi-Fi의 다른 기기에서: http://<내부IP>:${PORT}/index.html`);
});