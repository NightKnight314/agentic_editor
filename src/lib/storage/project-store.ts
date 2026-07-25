const DATABASE_NAME = "nightcut-workspace";
const DATABASE_VERSION = 1;
const FILE_STORE = "files";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(FILE_STORE)) request.result.createObjectStore(FILE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local workspace storage."));
  });
}

export async function saveWorkspaceFile(key: string, file: File) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FILE_STORE, "readwrite");
    transaction.objectStore(FILE_STORE).put(file, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save local media."));
  });
  database.close();
}

export async function loadWorkspaceFile(key: string) {
  const database = await openDatabase();
  const file = await new Promise<File | null>((resolve, reject) => {
    const transaction = database.transaction(FILE_STORE, "readonly");
    const request = transaction.objectStore(FILE_STORE).get(key);
    request.onsuccess = () => resolve(request.result instanceof File ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error("Unable to restore local media."));
  });
  database.close();
  return file;
}

export async function removeWorkspaceFile(key: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FILE_STORE, "readwrite");
    transaction.objectStore(FILE_STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Unable to remove local media."));
  });
  database.close();
}
