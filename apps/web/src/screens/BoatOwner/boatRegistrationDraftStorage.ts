const DATABASE_NAME = 'wwms-boat-registration-drafts';
const STORE_NAME = 'drafts';
const DATABASE_VERSION = 1;

export interface BoatFormData {
  name: string;
  registrationNumber: string;
  registrationDate: string;
  maximumCapacity: string;
  boatLength: string;
  hullNumber: string;
  boatWidth: string;
  maximumSpeedKnots: string;
  lifeJacketCount: string;
}

export interface CertificationDraft {
  id: string;
  name: string;
  fileName: string;
  file?: File;
  expirationDate?: string;
  requiresExpirationDate?: boolean;
}

export interface BoatRegistrationDraft {
  version: 1;
  boatForm: BoatFormData;
  boatPhoto: File | null;
  certifications: CertificationDraft[];
  savedAtUtc: string;
}

export async function saveBoatRegistrationDraft(
  ownerId: string,
  draft: Omit<BoatRegistrationDraft, 'version' | 'savedAtUtc'>,
): Promise<void> {
  const database = await openDatabase();
  try {
    await write(database, ownerId, {
      ...draft,
      version: 1,
      savedAtUtc: new Date().toISOString(),
    });
  } finally {
    database.close();
  }
}

export async function loadBoatRegistrationDraft(ownerId: string): Promise<BoatRegistrationDraft | undefined> {
  const database = await openDatabase();
  try {
    const value = await read(database, ownerId);
    return isBoatRegistrationDraft(value) ? value : undefined;
  } finally {
    database.close();
  }
}

export async function clearBoatRegistrationDraft(ownerId: string): Promise<void> {
  const database = await openDatabase();
  try {
    await remove(database, ownerId);
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Draft storage is not supported by this browser.'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open draft storage.'));
    request.onblocked = () => reject(new Error('Draft storage is currently unavailable.'));
  });
}

function write(database: IDBDatabase, ownerId: string, draft: BoatRegistrationDraft): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(draft, ownerId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save the boat draft.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Unable to save the boat draft.'));
  });
}

function read(database: IDBDatabase, ownerId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(ownerId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to restore the boat draft.'));
  });
}

function remove(database: IDBDatabase, ownerId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(ownerId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear the boat draft.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Unable to clear the boat draft.'));
  });
}

function isBoatRegistrationDraft(value: unknown): value is BoatRegistrationDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<BoatRegistrationDraft>;
  return draft.version === 1 && !!draft.boatForm && Array.isArray(draft.certifications);
}
