const key = userId => "smp-duty-draft-v1:" + userId;

export function saveDutyDraft(userId, draft) {
  if (!userId || !draft) return;
  try { localStorage.setItem(key(userId), JSON.stringify({ ...draft, savedAt: new Date().toISOString() })); }
  catch (e) { console.warn("Не удалось сохранить черновик:", e); }
}
export function loadDutyDraft(userId) {
  if (!userId) return null;
  try { const raw = localStorage.getItem(key(userId)); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
export function clearDutyDraft(userId) {
  if (!userId) return;
  try { localStorage.removeItem(key(userId)); } catch {}
}