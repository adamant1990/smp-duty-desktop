const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SESSION_KEY = "smpDutyDesktopSession";

const getSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
};

const saveSession = (session) =>
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));

const clearSession = () => localStorage.removeItem(SESSION_KEY);

const headers = (token) => ({
  apikey: key,
  Authorization: `Bearer ${token || key}`,
  "Content-Type": "application/json"
});

async function request(path, options = {}, token) {
  if (!url || !key) {
    throw new Error("Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...headers(token), ...(options.headers || {}) }
  });

  const text = await response.text();
  let data = null;

  try { data = text ? JSON.parse(text) : null; }
  catch { data = text; }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error_description ||
      data?.error ||
      text ||
      `HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function signIn(email, password) {
  const data = await request(
    "/auth/v1/token?grant_type=password",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  saveSession(data);
  return data;
}

export async function restoreSession() {
  const stored = getSession();
  if (!stored?.access_token) return null;

  try {
    await request("/auth/v1/user", {}, stored.access_token);
    return stored;
  } catch (error) {
    if (error.status !== 401 || !stored.refresh_token) {
      clearSession();
      return null;
    }

    try {
      const refreshed = await request(
        "/auth/v1/token?grant_type=refresh_token",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: stored.refresh_token })
        }
      );
      saveSession(refreshed);
      return refreshed;
    } catch {
      clearSession();
      return null;
    }
  }
}

export async function signOut() {
  const stored = getSession();

  try {
    if (stored?.access_token) {
      await request("/auth/v1/logout", { method: "POST" }, stored.access_token);
    }
  } catch {
    // Локальную сессию всё равно очищаем.
  } finally {
    clearSession();
  }
}

export async function profile(token) {
  const stored = getSession();
  if (!stored?.user?.id) return null;

  const rows = await request(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(stored.user.id)}&select=*`,
    {},
    token || stored.access_token
  );

  return rows?.[0] || null;
}

export const db = {
  staff: {
    list: (token) =>
      request("/rest/v1/staff?select=*&active=eq.true&order=full_name.asc", {}, token),

    add: (row, token) =>
      request("/rest/v1/staff", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row)
      }, token),

    update: (id, patch, token) =>
      request(`/rest/v1/staff?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch)
      }, token)
  },

  telegram: {
    list: (token) =>
      request("/rest/v1/rpc/admin_staff_telegram_accounts", {
        method: "POST",
        body: "{}"
      }, token),

    createLinkCode: (staffId, token) =>
      request("/functions/v1/telegram-duty-bot?action=create-link-code", {
        method: "POST",
        body: JSON.stringify({ staff_id: staffId })
      }, token),

    unlink: (staffId, token) =>
      request("/rest/v1/rpc/admin_unlink_telegram", {
        method: "POST",
        body: JSON.stringify({ p_staff_id: staffId })
      }, token)
  },

  duties: {
    list: (token) =>
      request("/rest/v1/duties?select=*&order=duty_date.desc,created_at.desc", {}, token),

    findByDate: (date, token) =>
      request(
        `/rest/v1/duties?duty_date=eq.${encodeURIComponent(date)}&select=id,duty_date`,
        {},
        token
      ),

    add: (row, token) =>
      request("/rest/v1/duties", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row)
      }, token),

    update: (id, patch, token) =>
      request(`/rest/v1/duties?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch)
      }, token),

    remove: (id, token) =>
      request(`/rest/v1/duties?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE"
      }, token)
  },

  crews: {
    list: (dutyId, token) =>
      request(
        `/rest/v1/duty_crews?duty_id=eq.${encodeURIComponent(dutyId)}&select=*&order=brigade_number.asc`,
        {},
        token
      ),

    add: (row, token) =>
      request("/rest/v1/duty_crews", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row)
      }, token),

    update: (id, patch, token) =>
      request(`/rest/v1/duty_crews?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch)
      }, token),

    remove: (id, token) =>
      request(`/rest/v1/duty_crews?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE"
      }, token)
  },

  members: {
    list: (crewIds, token) => {
      if (!crewIds.length) return Promise.resolve([]);
      const ids = crewIds.map(encodeURIComponent).join(",");
      return request(`/rest/v1/duty_members?crew_id=in.(${ids})&select=*`, {}, token);
    },

    addMany: (rows, token) =>
      rows.length
        ? request("/rest/v1/duty_members", {
            method: "POST",
            body: JSON.stringify(rows)
          }, token)
        : Promise.resolve([]),

    removeByCrew: (crewId, token) =>
      request(`/rest/v1/duty_members?crew_id=eq.${encodeURIComponent(crewId)}`, {
        method: "DELETE"
      }, token)
  }
};
