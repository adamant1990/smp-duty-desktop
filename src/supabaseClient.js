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
,
    publishDutyChanges: (body, token) => request("/functions/v1/telegram-duty-changes", {
      method: "POST",
      body: JSON.stringify(body)
    }, token)
  },

  duties: {
    updateFull: async (dutyId, dutyDate, dispatcherId, crews, token) => {
      // Повторяем рабочую логику web-версии refactor/main-structure.
      const duties = await request(
        "/rest/v1/duties?id=eq." + encodeURIComponent(dutyId) + "&select=id,duty_date",
        {},
        token
      );

      if (!duties?.[0]) throw new Error("Наряд не найден.");
      if (dutyDate < new Date().toLocaleDateString("en-CA")) throw new Error("Редактирование этого наряда уже закрыто: дата наряда прошла.");
      if (!Array.isArray(crews) || crews.length !== 8) throw new Error("Наряд должен содержать 8 бригад.");
      const missingParamedics = crews
        .filter(crew => !(crew.members || []).some(member => member.position === "paramedic" && member.staff_id))
        .map(crew => Number(crew.number));
      if (missingParamedics.length) {
        throw new Error(
          "Нельзя сохранить пустой состав. Не определён фельдшер в бригадах №" +
          missingParamedics.join(", №") + "."
        );
      }

      const oldDutyDate = duties[0].duty_date || null;
      const dateConflicts = await request("/rest/v1/duties?duty_date=eq." + encodeURIComponent(dutyDate) + "&id=neq." + encodeURIComponent(dutyId) + "&select=id", {}, token);
      if (dateConflicts?.length) throw new Error("На указанную дату уже существует другой наряд.");

      const existingCrews = await request(
        "/rest/v1/duty_crews?duty_id=eq." + encodeURIComponent(dutyId) + "&select=id,brigade_number",
        {},
        token
      );

      const oldCrewIds = (existingCrews || []).map((crew) => crew.id);
      const oldMembers = oldCrewIds.length
        ? await request("/rest/v1/duty_members?crew_id=in.(" + oldCrewIds.map(encodeURIComponent).join(",") + ")&select=crew_id,staff_id,position,shift,start_time,end_time", {}, token)
        : [];
      const oldCrewMap = new Map((existingCrews || []).map(crew => [crew.id, Number(crew.brigade_number)]));
      const oldAssignments = (oldMembers || []).map(member => ({
        staff_id: member.staff_id,
        position: member.position,
        shift: member.shift,
        start_time: member.start_time,
        end_time: member.end_time,
        brigade_number: oldCrewMap.get(member.crew_id)
      })).filter(x => x.brigade_number != null);

      await request("/rest/v1/duties?id=eq." + encodeURIComponent(dutyId), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ duty_date: dutyDate, dispatcher_id: dispatcherId })
      }, token);

      if (oldCrewIds.length) {
        const ids = oldCrewIds.map(encodeURIComponent).join(",");
        await request("/rest/v1/duty_members?crew_id=in.(" + ids + ")", {
          method: "DELETE"
        }, token);
      }

      const existingByNumber = new Map(
        (existingCrews || []).map((crew) => [Number(crew.brigade_number), crew.id])
      );

      const preparedCrews = await Promise.all((crews || []).map(async (crewData) => {
        const brigadeNumber = Number(crewData.number ?? crewData.id);
        if (!Number.isInteger(brigadeNumber) || brigadeNumber < 1 || brigadeNumber > 8) {
          throw new Error("Некорректный номер бригады при редактировании наряда.");
        }
        let crewId = existingByNumber.get(brigadeNumber);

        if (crewId) {
          await request("/rest/v1/duty_crews?id=eq." + encodeURIComponent(crewId), {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              brigade_number: brigadeNumber,
              brigade_type: "Линейная фельдшерская"
            })
          }, token);
        } else {
          const created = await request("/rest/v1/duty_crews", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              duty_id: dutyId,
              brigade_number: brigadeNumber,
              brigade_type: "Линейная фельдшерская"
            })
          }, token);
          crewId = created?.[0]?.id;
        }

        if (!crewId) throw new Error("Не удалось обновить бригаду №" + brigadeNumber + ".");

        const members = (crewData.members || [])
          .filter((item) => item.staff_id)
          .map((item) => ({
            crew_id: crewId,
            staff_id: item.staff_id,
            position: item.position,
            shift: item.shift,
            start_time: item.start_time,
            end_time: item.end_time
          }));

        return { brigadeNumber, crewId, members };
      }));

      const rows = preparedCrews.flatMap((crew) => crew.members);
      if (!rows.length) {
        throw new Error("Новый состав наряда пуст. Старый состав не был изменён.");
      }

      await request("/rest/v1/duty_members", {
        method: "POST",
        body: JSON.stringify(rows)
      }, token);

      const savedMembers = await request(
        "/rest/v1/duty_members?crew_id=in.(" +
        preparedCrews.map(crew => encodeURIComponent(crew.crewId)).join(",") +
        ")&select=id,crew_id,staff_id,position,shift,start_time,end_time",
        {},
        token
      );

      if (!Array.isArray(savedMembers) || savedMembers.length !== rows.length) {
        throw new Error(
          "Состав наряда не был полностью записан в базу. Сохранение остановлено."
        );
      }

      const used = new Set((crews || []).map((crew) => Number(crew.id)));
      const unusedCrewIds = (existingCrews || [])
        .filter((crew) => !used.has(Number(crew.brigade_number)))
        .map((crew) => crew.id);

      if (unusedCrewIds.length) {
        const ids = unusedCrewIds.map(encodeURIComponent).join(",");
        await request("/rest/v1/duty_crews?id=in.(" + ids + ")", {
          method: "DELETE"
        }, token);
      }

      if (oldDutyDate === dutyDate) {
        try {
          await request("/functions/v1/telegram-duty-changes", {
            method: "POST",
            body: JSON.stringify({
              duty_id: dutyId,
              duty_date: dutyDate,
              old_members: oldAssignments,
              new_members: preparedCrews.flatMap(crew => crew.members.map(row => ({
                staff_id: row.staff_id,
                position: row.position,
                shift: row.shift,
                start_time: row.start_time,
                end_time: row.end_time,
                brigade_number: crew.brigadeNumber
              })))
            })
          }, token);
        } catch (e) {
          console.warn("Telegram duty change notification failed:", e);
        }
      }

      return { success: true, dutyId, oldDutyDate, crewCount: preparedCrews.length };
    },

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

    removeByCrew: (crewId, token) => {
      const ids = Array.isArray(crewId) ? crewId : [crewId];
      if (!ids.length) return Promise.resolve([]);
      const query = ids.map(encodeURIComponent).join(",");
      return request(`/rest/v1/duty_members?crew_id=in.(${query})`, {
        method: "DELETE"
      }, token);
    }
  }
};
