(async function() {
  // 初期チェックを実行
  await checkAndHandleBlockedSite();
  
  // 許可時間の追跡と定期的なチェックをセットアップ
  setupPermissionTracker();
})();

// サイトのブロックチェックと処理を行う関数
async function checkAndHandleBlockedSite() {
  // 現在のドメインを取得
  const currentDomain = window.location.hostname;

  // ストレージからブロック設定を取得
  const { blockedDomains = [] } = await chrome.storage.sync.get({ blockedDomains: [] });
  
  // ドメインの正確なマッチングをする
  const isBlocked = blockedDomains.some(domain => {
    return currentDomain === domain || 
           currentDomain.endsWith('.' + domain);
  });
  
  if (!isBlocked) {
    // ブロック対象でなければ終了
    return false;
  }

  // バックグラウンドスクリプトにブロック通知を送信（統計用）
  chrome.runtime.sendMessage({
    type: 'siteBlocked',
    domain: currentDomain
  });

  // このドメインに対する「許可期限」があるかチェック
  const { allowedUntil = {} } = await chrome.storage.local.get({ allowedUntil: {} });
  const now = Date.now();
  
  if (allowedUntil[currentDomain] && allowedUntil[currentDomain] > now) {
    // まだアクセス許可時間内なら何もしない
    const remainingMinutes = Math.ceil((allowedUntil[currentDomain] - now) / (60 * 1000));
    console.log(`このサイトは残り約${remainingMinutes}分間アクセス可能です`);
    return false;
  }

  // ここからオーバーレイ表示の処理
  showBlockOverlay(currentDomain);
  return true;
}

// オーバーレイを表示する関数
function showBlockOverlay(currentDomain) {
  // 既にオーバーレイがある場合は何もしない
  if (document.getElementById('block-overlay')) {
    return;
  }

  // モダンなオーバーレイUIを生成
  const overlay = document.createElement('div');
  overlay.id = 'block-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(245, 247, 250, 0.97)';
  overlay.style.backdropFilter = 'blur(5px)';
  overlay.style.zIndex = '999999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.fontFamily = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // コンテナを作成
  const container = document.createElement('div');
  container.style.backgroundColor = 'white';
  container.style.borderRadius = '12px';
  container.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.12)';
  container.style.padding = '32px';
  container.style.width = '500px';
  container.style.maxWidth = '90%';
  container.style.textAlign = 'center';

  // ヘッダー
  const header = document.createElement('h2');
  header.innerText = 'サイトアクセスの制限';
  header.style.color = '#1a73e8';
  header.style.margin = '0 0 24px 0';
  header.style.fontSize = '24px';

  // 説明文
  const instruction = document.createElement('p');
  instruction.innerText = 'このサイトへのアクセスを制限中です。以下の手順でアクセスを一時的に許可します：';
  instruction.style.marginBottom = '20px';
  instruction.style.color = '#5f6368';
  instruction.style.fontSize = '16px';

  // 手順リスト
  const steps = document.createElement('ol');
  steps.style.textAlign = 'left';
  steps.style.color = '#5f6368';
  steps.style.paddingLeft = '20px';
  steps.style.marginBottom = '24px';

  const step1 = document.createElement('li');
  step1.innerText = 'アクセス許可時間を選択してください';
  step1.style.marginBottom = '10px';

  const step2 = document.createElement('li');
  step2.innerText = '下の文章を正確に入力してください';
  step2.style.marginBottom = '10px';

  const step3 = document.createElement('li');
  step3.innerText = '「アクセスを許可」ボタンをクリックしてください';

  steps.appendChild(step1);
  steps.appendChild(step2);
  steps.appendChild(step3);

  // 時間選択ボタンコンテナ
  const buttonContainer = document.createElement('div');
  buttonContainer.style.margin = '24px 0';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'center';
  buttonContainer.style.gap = '12px';

  // 時間選択ボタン
  const times = [5, 15, 30];
  let selectedTime = null;
  let selectedButton = null;

  times.forEach((minutes) => {
    const btn = document.createElement('button');
    btn.innerText = `${minutes} 分`;
    btn.style.padding = '10px 16px';
    btn.style.borderRadius = '8px';
    btn.style.border = '1px solid #dadce0';
    btn.style.backgroundColor = 'white';
    btn.style.color = '#1a73e8';
    btn.style.fontSize = '16px';
    btn.style.fontWeight = '500';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'all 0.2s ease';

    btn.addEventListener('mouseover', () => {
      if (btn !== selectedButton) {
        btn.style.backgroundColor = '#f8f9fa';
        btn.style.transform = 'translateY(-2px)';
      }
    });

    btn.addEventListener('mouseout', () => {
      if (btn !== selectedButton) {
        btn.style.backgroundColor = 'white';
        btn.style.transform = 'translateY(0)';
      }
    });

    btn.addEventListener('click', () => {
      selectedTime = minutes;
      
      // 以前選択したボタンのスタイルをリセット
      if (selectedButton) {
        selectedButton.style.backgroundColor = 'white';
        selectedButton.style.color = '#1a73e8';
        selectedButton.style.border = '1px solid #dadce0';
        selectedButton.style.transform = 'translateY(0)';
      }
      
      // 選択したボタンのスタイルを変更
      btn.style.backgroundColor = '#1a73e8';
      btn.style.color = 'white';
      btn.style.border = '1px solid #1a73e8';
      btn.style.transform = 'translateY(-2px)';
      selectedButton = btn;
    });
    
    buttonContainer.appendChild(btn);
  });

  const textToCopy = "I will use this site only for the necessary time.";
  
  // テキスト入力エリアラベル
  const textBoxLabel = document.createElement('p');
  textBoxLabel.innerText = `以下の文章を書き写してください：`;
  textBoxLabel.style.marginBottom = '8px';
  textBoxLabel.style.color = '#5f6368';
  
  // コピーするテキスト表示
  const textToType = document.createElement('p');
  textToType.innerText = `「${textToCopy}」`;
  textToType.style.fontWeight = 'bold';
  textToType.style.color = '#202124';
  textToType.style.marginBottom = '16px';
  textToType.style.padding = '12px';
  textToType.style.backgroundColor = '#f8f9fa';
  textToType.style.borderRadius = '8px';

  // テキスト入力フィールド
  const textBox = document.createElement('input');
  textBox.type = 'text';
  textBox.style.width = '100%';
  textBox.style.padding = '12px';
  textBox.style.borderRadius = '8px';
  textBox.style.border = '1px solid #dadce0';
  textBox.style.fontSize = '16px';
  textBox.style.marginBottom = '24px';
  textBox.style.boxSizing = 'border-box';
  textBox.placeholder = 'ここに上記の文章を入力してください';

  // コピーペースト無効化
  textBox.addEventListener('paste', (e) => {
    e.preventDefault();
    return false;
  });

  textBox.addEventListener('copy', (e) => {
    e.preventDefault();
    return false;
  });

  textBox.addEventListener('cut', (e) => {
    e.preventDefault();
    return false;
  });


  // テキストがリアルタイムで一致するか確認
  textBox.addEventListener('input', () => {
    if (textBox.value === textToCopy) {
      textBox.style.borderColor = '#34a853';
      textBox.style.backgroundColor = '#f0f9f0';
    } else {
      textBox.style.borderColor = '#dadce0';
      textBox.style.backgroundColor = 'white';
    }
  });

  // アクセス許可ボタン
  const allowButton = document.createElement('button');
  allowButton.innerText = 'アクセスを許可';
  allowButton.style.backgroundColor = '#1a73e8';
  allowButton.style.color = 'white';
  allowButton.style.border = 'none';
  allowButton.style.borderRadius = '8px';
  allowButton.style.padding = '12px 24px';
  allowButton.style.fontSize = '16px';
  allowButton.style.fontWeight = '500';
  allowButton.style.cursor = 'pointer';
  allowButton.style.transition = 'all 0.2s ease';
  
  allowButton.addEventListener('mouseover', () => {
    allowButton.style.backgroundColor = '#1765cc';
    allowButton.style.transform = 'translateY(-2px)';
  });
  
  allowButton.addEventListener('mouseout', () => {
    allowButton.style.backgroundColor = '#1a73e8';
    allowButton.style.transform = 'translateY(0)';
  });

  allowButton.addEventListener('click', async () => {
    // 入力チェック
    if (textBox.value !== textToCopy) {
      showMessage('文章が正しくありません。', 'error');
      textBox.style.borderColor = '#ea4335';
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
    const messageEl = document.createElement('div');
    messageEl.innerText = msg;
    messageEl.style.padding = '12px 16px';
    messageEl.style.marginTop = '16px';
    messageEl.style.borderRadius = '8px';
    messageEl.style.animation = 'fadeIn 0.3s ease';
    
    if (type === 'error') {
      messageEl.style.backgroundColor = '#fdede9';
      messageEl.style.color = '#ea4335';
      messageEl.style.border = '1px solid #ea4335';
    } else {
      messageEl.style.backgroundColor = '#e6f4ea';
      messageEl.style.color = '#34a853';
      messageEl.style.border = '1px solid #34a853';
    }
    
    // 既存のメッセージがあれば削除
    const existingMessage = container.querySelector('.message');
    if (existingMessage) {
      container.removeChild(existingMessage);
    }
    
    messageEl.classList.add('message');
    container.appendChild(messageEl);
    
    // 一定時間後にエラーメッセージを消す（成功メッセージはオーバーレイと一緒に消える）
    if (type === 'error') {
      setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
          }
        }, 300);
      }, 3000);
    }
  }

  // スタイル用CSSを追加
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);

  // 要素を組み立てる
  container.appendChild(header);
  container.appendChild(instruction);
  container.appendChild(steps);
  container.appendChild(buttonContainer);
  container.appendChild(textBoxLabel);
  container.appendChild(textToType);
  container.appendChild(textBox);
  container.appendChild(allowButton);
  overlay.appendChild(container);

  // ページに挿入
  document.body.appendChild(overlay);
}

// 許可時間の追跡とチェックをセットアップする関数
function setupPermissionTracker() {
  let nextCheckTimeout = null;
  
  // チェック関数
  async function checkPermission() {
    const currentDomain = window.location.hostname;
    const { allowedUntil = {} } = await chrome.storage.local.get({ allowedUntil: {} });
    const now = Date.now();
    
    // このドメインに対する許可があるか
    if (allowedUntil[currentDomain] && allowedUntil[currentDomain] > now) {
      // 許可時間までの残り時間を計算
      const timeRemaining = allowedUntil[currentDomain] - now;
      
      // 次回チェックのタイミングを設定
      let nextCheckDelay= 20000; // 
      
      
      // 次回チェックまでの時間が残り時間より長いなら、ちょうど許可時間が切れるタイミングでチェック
      if (nextCheckDelay > timeRemaining) {
        nextCheckDelay = timeRemaining + 100; // 少し余裕を持たせる
      }
      
      // 次回のチェックをスケジュール
      nextCheckTimeout = setTimeout(checkPermission, nextCheckDelay);
      
    } else {
      // 許可時間が切れているか、許可がない場合
      await checkAndHandleBlockedSite();
    }
  }
  
  // 初回チェックを20秒後に設定
  nextCheckTimeout = setTimeout(checkPermission, 20000);
  
  // ページがアンロードされるときにタイマーをクリア
  window.addEventListener('beforeunload', () => {
    if (nextCheckTimeout) {
      clearTimeout(nextCheckTimeout);
    }
  });
}