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
    // 저장된 탭 복원 또는 첫 번째 탭 생성
    this.restoreTabs();
    this.setupEventListeners();
  }

  restoreTabs() {
    const savedTabs = localStorage.getItem('tabs');
    const savedActiveTabId = localStorage.getItem('activeTabId');

    if (savedTabs) {
      try {
        const tabs = JSON.parse(savedTabs);
        if (tabs.length > 0) {
          this.tabs = tabs;
          this.tabCounter = Math.max(...tabs.map(t => parseInt(t.id.split('-')[1])));

          // 탭 UI 렌더링
          tabs.forEach(tab => this.renderTab(tab));

          // 활성 탭 복원
          const activeTabId = savedActiveTabId || tabs[0].id;
          this.switchTab(activeTabId);
          return;
        }
      } catch (e) {
        console.error('Failed to restore tabs:', e);
      }
    }

    // 저장된 탭이 없으면 새 탭 생성
    this.createTab();
  }

  saveTabs() {
    // 현재 탭 상태 저장
    if (this.activeTabId) {
      const currentTab = this.tabs.find(t => t.id === this.activeTabId);
      if (currentTab) {
        currentTab.content = editor.value;
        currentTab.cursorPosition = editor.selectionStart;
      }
    }

    localStorage.setItem('tabs', JSON.stringify(this.tabs));
    localStorage.setItem('activeTabId', this.activeTabId);
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

      // 탭 변경 시 저장
      this.saveTabs();
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
        // 웹 버전에서는 저장 기능 제거됨
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

    // 탭 삭제 후 저장
    this.saveTabs();
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


// 초기화
const editor = document.getElementById('editor');
const tabManager = new TabManager();

// 조합 중 여부 체크 (모바일 한글 입력 등)
let isComposing = false;

editor.addEventListener('compositionstart', () => {
  isComposing = true;
});

editor.addEventListener('compositionend', () => {
  isComposing = false;
  tabManager.markTabAsModified(true);
  renderHyperlinks();
  updateStatusBar();
});

// 이벤트 리스너
editor.addEventListener('input', () => {
  if (!isComposing) {
    tabManager.markTabAsModified(true);
    renderHyperlinks();
    updateStatusBar();
    tabManager.saveTabs();
  }
});

editor.addEventListener('click', updateStatusBar);
editor.addEventListener('keyup', updateStatusBar);

// 복사 및 초기화 버튼
document.getElementById('copyBtn').onclick = () => {
  const text = editor.value;
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('복사되었습니다!');
    }).catch(() => {
      // fallback for older browsers
      editor.select();
      document.execCommand('copy');
      alert('복사되었습니다!');
    });
  }
};

document.getElementById('clearBtn').onclick = () => {
  if (confirm('현재 내용을 모두 삭제하시겠습니까?')) {
    editor.value = '';
    tabManager.markTabAsModified(true);
    renderHyperlinks();
    updateStatusBar();
    tabManager.saveTabs();
    editor.focus();
  }
};

// 초기 상태바 업데이트
updateStatusBar();

