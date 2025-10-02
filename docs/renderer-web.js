// 웹 버전 렌더러 (Electron 의존성 제거)

// 탭 관리
class TabManager {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.tabCounter = 0;
    this.init();
  }

  init() {
    // 첫 번째 탭 생성
    this.createTab();
    this.setupEventListeners();
  }

  createTab(fileName = null, content = '') {
    const tabId = `tab-${++this.tabCounter}`;
    const tab = {
      id: tabId,
      title: fileName || '제목 없음',
      fileName: fileName,
      content: content,
      saved: true,
      cursorPosition: 0
    };

    this.tabs.push(tab);
    this.renderTab(tab);
    this.switchTab(tabId);
  }

  renderTab(tab) {
    const tabsContainer = document.getElementById('tabs');
    const tabElement = document.createElement('div');
    tabElement.className = 'tab';
    tabElement.dataset.tabId = tab.id;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tab-title';
    titleSpan.textContent = tab.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    };

    tabElement.appendChild(titleSpan);
    tabElement.appendChild(closeBtn);

    tabElement.onclick = () => this.switchTab(tab.id);

    tabsContainer.appendChild(tabElement);
  }

  switchTab(tabId) {
    if (this.activeTabId) {
      // 현재 탭 상태 저장
      const currentTab = this.tabs.find(t => t.id === this.activeTabId);
      if (currentTab) {
        currentTab.content = editor.value;
        currentTab.cursorPosition = editor.selectionStart;
      }
    }

    this.activeTabId = tabId;
    const tab = this.tabs.find(t => t.id === tabId);

    if (tab) {
      // 탭 UI 업데이트
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tabId === tabId);
      });

      // 에디터 내용 로드
      editor.value = tab.content;
      editor.setSelectionRange(tab.cursorPosition, tab.cursorPosition);
      editor.focus();

      // 하이퍼링크 렌더링
      renderHyperlinks();
      updateStatusBar();
    }
  }

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];

    // 저장되지 않은 변경사항 확인
    if (!tab.saved) {
      const response = confirm(`${tab.title}의 변경사항을 저장하시겠습니까?`);
      if (response) {
        saveFile();
      }
    }

    // 탭 제거
    this.tabs.splice(tabIndex, 1);
    document.querySelector(`.tab[data-tab-id="${tabId}"]`).remove();

    // 탭이 모두 닫히면 새 탭 생성
    if (this.tabs.length === 0) {
      this.createTab();
    } else {
      // 다른 탭으로 전환
      const newActiveTab = this.tabs[Math.max(0, tabIndex - 1)];
      this.switchTab(newActiveTab.id);
    }
  }

  getCurrentTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  }

  updateTabTitle(title) {
    const tab = this.getCurrentTab();
    if (tab) {
      tab.title = title;
      const tabElement = document.querySelector(`.tab[data-tab-id="${tab.id}"] .tab-title`);
      if (tabElement) {
        tabElement.textContent = title;
      }
    }
  }

  markTabAsModified(modified) {
    const tab = this.getCurrentTab();
    if (tab) {
      tab.saved = !modified;
      const title = tab.title.replace(' *', '');
      tab.title = modified ? `${title} *` : title;
      this.updateTabTitle(tab.title);
    }
  }

  setupEventListeners() {
    document.getElementById('newTabBtn').onclick = () => this.createTab();
  }
}

// 하이퍼링크 감지 및 변환
function renderHyperlinks() {
  const text = editor.value;
  const preview = document.getElementById('preview');

  // URL 패턴을 찾아서 링크로 변환
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  html = html.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `http://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  preview.innerHTML = html;
}

// 찾기/바꾸기 기능
class FindReplace {
  constructor() {
    this.lastSearchTerm = '';
    this.lastIndex = 0;
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('closeFindDialog').onclick = () => this.close();
    document.getElementById('findNextBtn').onclick = () => this.findNext();
    document.getElementById('replaceBtn').onclick = () => this.replace();
    document.getElementById('replaceAllBtn').onclick = () => this.replaceAll();

    // Enter 키로 찾기
    document.getElementById('findInput').onkeypress = (e) => {
      if (e.key === 'Enter') this.findNext();
    };
  }

  open(replaceMode = false) {
    const dialog = document.getElementById('findDialog');
    dialog.classList.add('active');
    document.getElementById('findInput').focus();

    if (replaceMode) {
      document.getElementById('replaceInput').parentElement.style.display = 'block';
    }
  }

  close() {
    const dialog = document.getElementById('findDialog');
    dialog.classList.remove('active');
  }

  findNext() {
    const searchTerm = document.getElementById('findInput').value;
    const caseSensitive = document.getElementById('caseSensitive').checked;

    if (!searchTerm) return;

    let text = editor.value;
    let searchText = text;
    let term = searchTerm;

    if (!caseSensitive) {
      searchText = text.toLowerCase();
      term = searchTerm.toLowerCase();
    }

    // 새로운 검색어면 처음부터 시작
    if (searchTerm !== this.lastSearchTerm) {
      this.lastIndex = 0;
      this.lastSearchTerm = searchTerm;
    }

    const index = searchText.indexOf(term, this.lastIndex);

    if (index !== -1) {
      editor.focus();
      editor.setSelectionRange(index, index + searchTerm.length);
      this.lastIndex = index + 1;
    } else {
      // 끝까지 갔으면 처음부터 다시 검색
      this.lastIndex = 0;
      const firstIndex = searchText.indexOf(term, 0);
      if (firstIndex !== -1) {
        editor.focus();
        editor.setSelectionRange(firstIndex, firstIndex + searchTerm.length);
        this.lastIndex = firstIndex + 1;
      } else {
        alert('검색 결과가 없습니다.');
      }
    }
  }

  replace() {
    const searchTerm = document.getElementById('findInput').value;
    const replaceTerm = document.getElementById('replaceInput').value;

    if (!searchTerm) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);

    if (selectedText === searchTerm) {
      const before = editor.value.substring(0, start);
      const after = editor.value.substring(end);
      editor.value = before + replaceTerm + after;
      editor.setSelectionRange(start, start + replaceTerm.length);

      tabManager.markTabAsModified(true);
      renderHyperlinks();
      this.findNext();
    } else {
      this.findNext();
    }
  }

  replaceAll() {
    const searchTerm = document.getElementById('findInput').value;
    const replaceTerm = document.getElementById('replaceInput').value;
    const caseSensitive = document.getElementById('caseSensitive').checked;

    if (!searchTerm) return;

    let text = editor.value;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    const newText = text.replace(regex, replaceTerm);
    const count = (text.match(regex) || []).length;

    if (count > 0) {
      editor.value = newText;
      tabManager.markTabAsModified(true);
      renderHyperlinks();
      alert(`${count}개 항목을 바꿨습니다.`);
    } else {
      alert('검색 결과가 없습니다.');
    }
  }
}

// 상태바 업데이트
function updateStatusBar() {
  const text = editor.value;
  const cursorPos = editor.selectionStart;

  // 줄과 열 계산
  const textBeforeCursor = text.substring(0, cursorPos);
  const lines = textBeforeCursor.split('\n');
  const line = lines.length;
  const col = lines[lines.length - 1].length + 1;

  document.getElementById('lineCol').textContent = `줄 ${line}, 열 ${col}`;

  // 문자 수
  const charCount = text.length;
  document.getElementById('charCount').textContent = `${charCount} 자`;

  // 단어 수
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  document.getElementById('wordCount').textContent = `${words.length} 단어`;
}

// 파일 작업 (웹 버전)
function openFile() {
  const fileInput = document.getElementById('fileInput');
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        tabManager.createTab(file.name, event.target.result);
      };
      reader.readAsText(file);
    }
    fileInput.value = ''; // 리셋
  };
  fileInput.click();
}

function saveFile() {
  const tab = tabManager.getCurrentTab();
  const content = editor.value;
  const fileName = tab.fileName || 'untitled.txt';

  // Blob 생성 및 다운로드
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  tab.saved = true;
  tabManager.updateTabTitle(fileName.replace(' *', ''));
}

// 테마 전환
let isDarkMode = false;
function toggleTheme() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('dark-mode', isDarkMode);
  document.getElementById('themeIcon').textContent = isDarkMode ? '☀️' : '🌙';
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

// 초기화
const editor = document.getElementById('editor');
const tabManager = new TabManager();
const findReplace = new FindReplace();

// 이벤트 리스너
editor.addEventListener('input', () => {
  tabManager.markTabAsModified(true);
  renderHyperlinks();
  updateStatusBar();
});

editor.addEventListener('click', updateStatusBar);
editor.addEventListener('keyup', updateStatusBar);

// 도구 모음 버튼
document.getElementById('newBtn').onclick = () => tabManager.createTab();
document.getElementById('openBtn').onclick = openFile;
document.getElementById('saveBtn').onclick = saveFile;
document.getElementById('findBtn').onclick = () => findReplace.open(true);
document.getElementById('themeBtn').onclick = toggleTheme;

// 키보드 단축키
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch(e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        tabManager.createTab();
        break;
      case 't':
        e.preventDefault();
        tabManager.createTab();
        break;
      case 'o':
        e.preventDefault();
        openFile();
        break;
      case 's':
        e.preventDefault();
        saveFile();
        break;
      case 'f':
        e.preventDefault();
        findReplace.open(false);
        break;
      case 'h':
        e.preventDefault();
        findReplace.open(true);
        break;
    }
  }
});

// 초기 상태바 업데이트
updateStatusBar();

// 저장된 테마 적용
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  toggleTheme();
}

// 자동 저장 (5초마다 로컬스토리지에 저장)
setInterval(() => {
  const tab = tabManager.getCurrentTab();
  if (tab && !tab.saved) {
    localStorage.setItem(`autosave-${tab.id}`, editor.value);
  }
}, 5000);

// 페이지 나가기 전 경고
window.addEventListener('beforeunload', (e) => {
  const unsavedTab = tabManager.tabs.find(t => !t.saved);
  if (unsavedTab) {
    e.preventDefault();
    e.returnValue = '';
  }
});
