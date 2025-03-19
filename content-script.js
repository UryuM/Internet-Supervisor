async function showBlockOverlay(currentDomain) {
  // 既にオーバーレイがある場合は何もしない
  if (document.getElementById('block-overlay')) {
    return;
  }

  // ダークモードかどうかを検出
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let pageBgColor = window.getComputedStyle(document.body).backgroundColor;
  let rgb = pageBgColor.match(/\d+/g);
  const isDarkPage = rgb && (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2]))/3 < 128;
  const useDarkMode = isDarkMode || isDarkPage;

  try {
    // HTMLテンプレートを読み込む
    const extensionUrl = chrome.runtime.getURL('block-overlay.html');
    const response = await fetch(extensionUrl);
    const html = await response.text();
    
    // テンプレートをDOMに変換
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const template = doc.getElementById('overlay-template');
    
    // オーバーレイ要素の作成
    const overlay = document.createElement('div');
    overlay.id = 'block-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.fontFamily = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    overlay.style.backdropFilter = 'blur(5px)';
    
    // ダークモード用の背景色を設定
    if (useDarkMode) {
      overlay.style.backgroundColor = 'rgba(32, 33, 36, 0.97)';
      overlay.classList.add('dark-mode');
    } else {
      overlay.style.backgroundColor = 'rgba(245, 247, 250, 0.97)';
    }
    
    // テンプレートの内容をオーバーレイにコピー
    overlay.appendChild(template.content.cloneNode(true));
    
    // 表示要素の取得
    const timeButtonsContainer = overlay.querySelector('.time-buttons');
    const textInput = overlay.querySelector('.text-input');
    const allowButton = overlay.querySelector('.allow-button');
    
    // 時間選択ボタンを動的に追加
    const times = [5, 15, 30];
    let selectedTime = null;
    let selectedButton = null;
    
    times.forEach((minutes) => {
      const btn = document.createElement('button');
      btn.innerText = `${minutes} 分`;
      btn.className = 'time-button';
      
      // ダークモード用スタイル
      if (useDarkMode) {
        btn.classList.add('dark');
      }
      
      btn.addEventListener('click', () => {
        selectedTime = minutes;
        
        // 以前選択したボタンのスタイルをリセット
        if (selectedButton) {
          selectedButton.classList.remove('selected');
        }
        
        // 選択したボタンのスタイルを変更
        btn.classList.add('selected');
        selectedButton = btn;
      });
      
      timeButtonsContainer.appendChild(btn);
    });
    
    // 認証テキスト
    const textToCopy = "I will use this site only for the necessary time.";
    
    // ペースト無効化
    textInput.addEventListener('paste', (e) => {
      e.preventDefault();
      return false;
    });
    
    // テキストマッチングの監視
   textInput.addEventListener('input', () => {
      if (textInput.value === textToCopy) {
        textInput.classList.add('match');
      } else {
        textInput.classList.remove('match');
      }
    });

    // アクセス許可ボタンの処理
    allowButton.addEventListener('click', async () => {
      // 入力チェック
      if (textInput.value !== textToCopy) {
        showMessage('文章が正しくありません。', 'error');
        return;
      }
      if (!selectedTime) {
        showMessage('許可時間を選択してください。', 'error');
        return;
      }
      
      const newAllowedUntil = Date.now() + selectedTime * 60 * 1000;
      
      // ストレージに保存
      const { allowedUntil: storedAllowed = {} } = await chrome.storage.local.get({ allowedUntil: {} });
      storedAllowed[currentDomain] = newAllowedUntil;
      await chrome.storage.local.set({ allowedUntil: storedAllowed });
      
      // 統計情報を送信
      chrome.runtime.sendMessage({
        type: 'siteAllowed',
        domain: currentDomain,
        duration: selectedTime * 60 * 1000
      });
      
      // 成功メッセージを表示してからオーバーレイを消す
      showMessage(`${selectedTime}分間のアクセスが許可されました`, 'success');
      
      setTimeout(() => {
        overlay.remove();
      }, 1500);
    });
    
    // エラーまたは成功メッセージを表示する機能
    function showMessage(msg, type) {
      const messageContainer = overlay.querySelector('.message-container');
      messageContainer.innerHTML = ''; // 既存メッセージをクリア
      
      const messageEl = document.createElement('div');
      messageEl.innerText = msg;
      messageEl.className = `message ${type}`;
      
      messageContainer.appendChild(messageEl);
      
      // エラーメッセージは一定時間後に消える
      if (type === 'error') {
        setTimeout(() => {
          messageEl.style.opacity = '0';
          setTimeout(() => {
            messageEl.remove();
          }, 300);
        }, 3000);
      }
    }
    
    // ページに挿入
    document.body.appendChild(overlay);
    
  } catch (error) {
    console.error("オーバーレイの読み込みに失敗しました:", error);
  }
}