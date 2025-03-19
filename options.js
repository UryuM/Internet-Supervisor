document.addEventListener('DOMContentLoaded', () => {
  const newDomainInput = document.getElementById('newDomain');
  const addDomainButton = document.getElementById('addDomain');
  const domainList = document.getElementById('domainList');
  const emptyMessage = document.getElementById('emptyMessage');

  // 既存ドメインの読み込み
  chrome.storage.sync.get({ blockedDomains: [] }, ({ blockedDomains }) => {
    if (blockedDomains.length > 0) {
      emptyMessage.style.display = 'none';
      blockedDomains.forEach((domain) => {
        addDomainToList(domain);
      });
    } else {
      emptyMessage.style.display = 'flex';
    }
  });

  // ドメインの検証
  function isValidDomain(domain) {
    // 基本的なドメイン形式の検証（完全な検証ではないが、一般的なミスをチェック）
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
  }

  // エラーメッセージを表示する関数
  function showError(message) {
    // 既存のエラーメッセージがあれば削除
    const existingError = document.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.color = 'var(--error-color)';
    errorDiv.style.fontSize = '14px';
    errorDiv.style.marginTop = '8px';
    errorDiv.textContent = message;

    // 入力グループの後に挿入
    const inputGroup = document.querySelector('.input-group');
    inputGroup.parentNode.insertBefore(errorDiv, inputGroup.nextSibling);

    // 一定時間後に消える
    setTimeout(() => {
      errorDiv.style.opacity = '0';
      errorDiv.style.transition = 'opacity 0.5s ease';
      setTimeout(() => errorDiv.remove(), 500);
    }, 3000);
  }

  // エンターキーでも追加できるようにする
  newDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomainButton.click();
    }
  });

  // ドメインを追加する
  addDomainButton.addEventListener('click', () => {
    const domain = newDomainInput.value.trim().toLowerCase();

    if (!domain) {
      showError('ドメインを入力してください。');
      return;
    }

    if (!isValidDomain(domain)) {
      showError('有効なドメイン形式を入力してください。例: example.com');
      return;
    }

    chrome.storage.sync.get({ blockedDomains: [] }, ({ blockedDomains }) => {
      // 重複していないかチェック
      if (blockedDomains.includes(domain)) {
        showError('このドメインは既にブロックリストに追加されています。');
        return;
      }

      blockedDomains.push(domain);
      chrome.storage.sync.set({ blockedDomains }, () => {
        addDomainToList(domain);
        newDomainInput.value = '';

        // 空メッセージを非表示
        emptyMessage.style.display = 'none';

        // 追加成功メッセージを表示
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.color = 'var(--success-color)';
        successDiv.style.fontSize = '14px';
        successDiv.style.marginTop = '8px';
        successDiv.textContent = `${domain} をブロックリストに追加しました。`;

        const inputGroup = document.querySelector('.input-group');
        inputGroup.parentNode.insertBefore(successDiv, inputGroup.nextSibling);

        setTimeout(() => {
          successDiv.style.opacity = '0';
          successDiv.style.transition = 'opacity 0.5s ease';
          setTimeout(() => successDiv.remove(), 500);
        }, 3000);
      });
    });
  });

  // ドメインをリストに追加
  function addDomainToList(domain) {
    const li = document.createElement('li');

    const domainSpan = document.createElement('span');
    domainSpan.textContent = domain;
    domainSpan.className = 'domain-name';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-danger';
    removeBtn.innerHTML = '<span class="material-icons">delete</span> 削除';

    removeBtn.addEventListener('click', () => {
      chrome.storage.sync.get({ blockedDomains: [] }, ({ blockedDomains }) => {
        const newList = blockedDomains.filter(d => d !== domain);
        chrome.storage.sync.set({ blockedDomains: newList }, () => {
          // アニメーション付きで削除
          li.style.opacity = '0';
          li.style.transform = 'translateX(20px)';
          li.style.transition = 'all 0.3s ease';

          setTimeout(() => {
            domainList.removeChild(li);

            // リストが空になったら空メッセージを表示
            if (newList.length === 0) {
              emptyMessage.style.display = 'flex';
            }
          }, 300);

          // 削除確認メッセージ
          const confirmDiv = document.createElement('div');
          confirmDiv.className = 'success-message';
          confirmDiv.style.color = 'var(--success-color)';
          confirmDiv.style.fontSize = '14px';
          confirmDiv.style.marginTop = '8px';
          confirmDiv.textContent = `${domain} をブロックリストから削除しました。`;

          const cardContent = document.querySelector('.domain-list-card .card-content');
          cardContent.appendChild(confirmDiv);

          setTimeout(() => {
            confirmDiv.style.opacity = '0';
            confirmDiv.style.transition = 'opacity 0.5s ease';
            setTimeout(() => confirmDiv.remove(), 500);
          }, 3000);
        });
      });
    });

    li.appendChild(domainSpan);
    li.appendChild(removeBtn);
    domainList.appendChild(li);
  }
});