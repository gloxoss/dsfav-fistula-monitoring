export interface CaptureSessionResume {
  measurementId: string;
  idPseudo: string;
  deviceId: string;
  startedAt: string;
  lastState: string;
}

const STORAGE_KEY = "dsfav.capture.resume";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSession: CaptureSessionResume | null = null;

function notifyListeners(): void {
  cachedRaw = undefined;
  for (const listener of listeners) listener();
}

export function subscribeCaptureSession(listener: () => void): () => void {
  listeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", handleStorage);
  };
}

export function saveCaptureSession(session: CaptureSessionResume): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    notifyListeners();
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function readCaptureSession(): CaptureSessionResume | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedSession;
    cachedRaw = raw;
    if (!raw) {
      cachedSession = null;
      return cachedSession;
    }
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") {
      cachedSession = null;
      return cachedSession;
    }
    const session = value as Partial<CaptureSessionResume>;
    if (
      typeof session.measurementId !== "string" ||
      typeof session.idPseudo !== "string" ||
      typeof session.deviceId !== "string" ||
      typeof session.startedAt !== "string" ||
      typeof session.lastState !== "string"
    ) {
      cachedSession = null;
      return cachedSession;
    }
    cachedSession = session as CaptureSessionResume;
    return cachedSession;
  } catch {
    cachedRaw = null;
    cachedSession = null;
    return null;
  }
}

export function clearCaptureSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    notifyListeners();
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
