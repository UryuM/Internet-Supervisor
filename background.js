// バックグラウンドスクリプト：データ管理と拡張機能の状態管理を担当

// 初期設定
chrome.runtime.onInstalled.addListener(() => {
    // デフォルト設定
    chrome.storage.sync.get({ blockedDomains: [] }, (data) => {
      if (!data.blockedDomains || !Array.isArray(data.blockedDomains)) {
        // 初期設定（空の配列）を保存
        chrome.storage.sync.set({ blockedDomains: [] });
      }
    });
    
    // 初回インストール時には設定ページを開く
    chrome.tabs.create({ url: 'options.html' });
});

// ブラウザアクションのクリックでオプションページを開く
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// 定期的に期限切れの許可をクリーンアップ
setInterval(async () => {
  const { allowedUntil = {} } = await chrome.storage.local.get({ allowedUntil: {} });
  const now = Date.now();
  let hasExpired = false;
  
  // 期限切れのドメインを削除
  Object.keys(allowedUntil).forEach(domain => {
    if (allowedUntil[domain] < now) {
      delete allowedUntil[domain];
      hasExpired = true;
    }
  });
  
  // 変更があれば保存
  if (hasExpired) {
    await chrome.storage.local.set({ allowedUntil });
  }
}, 60000); // 1分ごとにチェック

// コンテキストメニュー項目の追加
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "blockThisSite",
    title: "このサイトをブロックリストに追加",
    contexts: ["page"]
  });
});

// コンテキストメニューのクリックイベント
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "blockThisSite" && tab && tab.url) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      
      if (domain) {
        // 現在のブロックリストを取得して追加
        chrome.storage.sync.get({ blockedDomains: [] }, ({ blockedDomains }) => {
          if (!blockedDomains.includes(domain)) {
            blockedDomains.push(domain);
            chrome.storage.sync.set({ blockedDomains }, () => {
              // 通知を表示
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon128.png',
                title: 'サイトをブロックしました',
                message: `${domain} がブロックリストに追加されました。`,
                priority: 2
              });
              
              // 現在のタブをリロード
              chrome.tabs.reload(tab.id);
            });
          } else {
            // 既に追加済み
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon128.png',
              title: 'サイトは既にブロック済みです',
              message: `${domain} は既にブロックリストに追加されています。`,
              priority: 2
            });
          }
        });
      }
    } catch (e) {
      console.error("URLの解析に失敗しました", e);
    }
  }
});

// 統計機能：ブロックされたサイトへのアクセス回数を記録
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'siteBlocked' && message.domain) {
    chrome.storage.local.get({ blockStats: {} }, ({ blockStats }) => {
      if (!blockStats[message.domain]) {
        blockStats[message.domain] = {
          blockedCount: 0,
          allowedCount: 0,
          lastBlocked: null
        };
      }
      
      blockStats[message.domain].blockedCount += 1;
      blockStats[message.domain].lastBlocked = new Date().toISOString();
      
      chrome.storage.local.set({ blockStats });
    });
  } else if (message.type === 'siteAllowed' && message.domain && message.duration) {
    chrome.storage.local.get({ blockStats: {} }, ({ blockStats }) => {
      if (!blockStats[message.domain]) {
        blockStats[message.domain] = {
          blockedCount: 0,
          allowedCount: 0,
          totalAllowedTime: 0
        };
      }
      
      blockStats[message.domain].allowedCount += 1;
      blockStats[message.domain].totalAllowedTime = 
        (blockStats[message.domain].totalAllowedTime || 0) + message.duration;
      
      chrome.storage.local.set({ blockStats });
    });
  }
  
  return true; // 非同期レスポンスのためにtrueを返す
});

// 残り時間をバッジに表示する機能

function updateBadge() {
  chrome.storage.local.get({ allowedUntil: {} }, ({ allowedUntil }) => {
    // 現在アクティブなタブのドメインを取得
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length === 0 || !tabs[0].url) return;
      
      try {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        
        // このドメインに対する許可時間があるかチェック
        if (allowedUntil[domain] && allowedUntil[domain] > Date.now()) {
          const remainingMs = allowedUntil[domain] - Date.now();
          // 残り時間（分）を計算
          const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
          // 残り時間（秒）を計算
          const remainingSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
          
          let badgeText;
          let badgeColor;
          
          // 残り1分未満なら秒表示、それ以外は分表示
          if (remainingMinutes < 1) {
            badgeText = `0:${remainingSeconds}`;
            badgeColor = '#ea4335'; // 赤色で警告
          } else if (remainingMinutes < 5) {
            // 残り5分未満は分:秒
            badgeText = `${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;
            badgeColor = '#fbbc04'; // 黄色で注意
          } else {
            // それ以外は分のみ
            badgeText = `${remainingMinutes}`;
            badgeColor = '#1a73e8'; // 青色
          }
          // バッジテキストを設定
          chrome.action.setBadgeText({ text: badgeText });
          chrome.action.setBadgeBackgroundColor({ color: badgeColor });
          // ツールチップも設定
          chrome.action.setTitle({ title: `${domain}: 残り ${remainingMinutes}分 ${remainingSeconds}秒` });
        } else {
          // 許可時間がない場合はバッジをクリア
          chrome.action.setBadgeText({ text: '' });
        }
      } catch (e) {
        console.error("URLの解析に失敗しました", e);
      }
    });
  });
}

// 定期的に更新（1秒ごと）
setInterval(updateBadge, 1000);

// タブが切り替わるたびに更新
chrome.tabs.onActivated.addListener(updateBadge);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateBadge();
  }
});