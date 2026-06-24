# 🏥 OTC Master 웹앱 — 팀원 초기 세팅 가이드

## 📌 프로젝트 링크
- 웹앱 주소: https://stunning-bubblegum-5e76cb.netlify.app
- GitHub 저장소: https://github.com/andi1213/OTCmaster-webapp

---

## ✅ 세팅 순서 (처음 한 번만 하면 됩니다)

### 1단계: GitHub 가입
- https://github.com 에서 회원가입
- 가입 후 **GitHub 아이디를 팀장에게 알려주세요** (collaborator 초대를 위해)

### 2단계: Node.js 설치
- https://nodejs.org 접속
- **LTS** 버전 (왼쪽 초록 버튼) 다운로드 → 설치
- 설치할 때 옵션은 전부 기본값으로 Next 누르면 됩니다

### 3단계: Git 설치 (Windows만 해당)
- https://git-scm.com/download/win 에서 다운로드 → 설치
- Mac은 이미 설치되어 있으므로 생략

### 4단계: Claude Code 설치
- 터미널(명령 프롬프트 또는 PowerShell)을 열고 아래 명령어 입력:
```
npm install -g @anthropic-ai/claude-code
```

### 5단계: 코드 받기
- 터미널에서 원하는 폴더로 이동 후 아래 명령어 입력:
```
git clone https://github.com/andi1213/OTCmaster-webapp.git
cd OTCmaster-webapp
npm install
```

### 6단계: Git 사용자 설정 (처음 한 번만)
```
git config --global user.name "본인 GitHub 아이디"
git config --global user.email "본인 이메일"
```

---

## 🔧 개발하는 법

### 로컬에서 웹앱 실행하기
```
cd OTCmaster-webapp
npm start
```
→ 브라우저에서 http://localhost:3000 접속하면 웹앱이 뜹니다

### Claude Code로 코드 수정하기
```
cd OTCmaster-webapp
claude
```
→ Claude에게 자연어로 수정 요청하면 됩니다
→ 예: "시뮬레이션에서 환자 유형 추가해줘"

### 수정한 코드 올리기
Claude에게 이렇게 말하면 됩니다:
> "커밋하고 push해줘"

또는 직접 터미널에서:
```
git add .
git commit -m "수정 내용 설명"
git push
```
→ GitHub에 올라가면 웹사이트(Netlify)가 자동으로 업데이트됩니다

### 다른 팀원이 올린 최신 코드 받기
```
git pull
```

---

## 📁 프로젝트 구조 (참고)

```
OTCmaster-webapp/
├── server.js              ← Express 서버 (API 프록시)
├── package.json           ← 프로젝트 설정
├── netlify.toml           ← Netlify 배포 설정
└── public/                ← 웹앱 프론트엔드
    ├── index.html         ← 메인 페이지
    ├── app.js             ← 앱 로직 (화면 전환, 시뮬레이션 등)
    ├── style.css          ← 스타일
    └── data/
        ├── categories.js  ← 카테고리 데이터
        ├── drugs.js       ← 의약품/성분 데이터 (68KB)
        └── content.js     ← 학습 내용 데이터
```

---

## ❓ 자주 묻는 질문

**Q: push가 안 돼요 (permission denied)**
→ 팀장이 GitHub collaborator로 초대했는지 확인. 초대 이메일에서 수락해야 합니다.

**Q: 다른 팀원과 코드가 충돌해요**
→ `git pull` 먼저 한 후 `git push` 하세요. 충돌이 나면 Claude에게 "충돌 해결해줘"라고 하면 됩니다.

**Q: 웹사이트에 반영이 안 돼요**
→ push 후 1~2분 기다리면 Netlify가 자동 배포합니다. https://app.netlify.com 에서 배포 상태를 확인할 수 있습니다.

**Q: OpenAI API Key는 어떻게 하나요?**
→ 웹앱 접속 → 오른쪽 위 ⚙(설정) → API Key 입력. 각자 본인 키를 입력하면 됩니다. (서버에 저장되지 않음)
