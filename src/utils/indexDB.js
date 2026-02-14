const DB_NAME = 'fundDB';
const DB_VERSION = 1;
const STORE_NAME = 'funds';

// 打开数据库
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject('数据库打开失败');
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'code' });
      }
    };
  });
}

// 存储基金数据
export async function storeFunds(funds) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // 清空现有数据
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject('清空数据失败');
    
    clearRequest.onsuccess = () => {
      // 批量添加数据
      const addPromises = funds.map(fund => {
        return new Promise((addResolve, addReject) => {
          const request = store.add({
            code: fund[0],
            shortName: fund[1],
            name: fund[2],
            type: fund[3],
            pinyin: fund[4]
          });
          request.onsuccess = () => addResolve();
          request.onerror = () => addReject('添加数据失败');
        });
      });
      
      Promise.all(addPromises)
        .then(() => resolve())
        .catch(reject);
    };
  });
}

// 获取所有基金数据
export async function getAllFunds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('获取数据失败');
  });
}

// 检查是否存在基金数据
export async function hasFunds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();
    
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject('检查数据失败');
  });
}

// 搜索基金
export async function searchFunds(keyword) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const funds = request.result;
      const filteredFunds = funds.filter(fund => 
        fund.code.includes(keyword) || 
        fund.name.includes(keyword) || 
        fund.pinyin.includes(keyword.toUpperCase())
      );
      resolve(filteredFunds);
    };
    request.onerror = () => reject('搜索数据失败');
  });
}

// 根据基金代码查询基金
export async function getFundByCode(code) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(code);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject('查询数据失败');
  });
}