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
      const duties = await request(
        "/rest/v1/duties?id=eq." + encodeURIComponent(dutyId) + "&select=id,duty_date",
        {},
        token
      );

      if (!duties?.[0]) throw new Error("Наряд не найден.");
      if (dutyDate < new Date().toLocaleDateString("en-CA")) {
        throw new Error("Редактирование этого наряда уже закрыто: дата наряда прошла.");
      }

      if (!Array.isArray(crews) || crews.length !== 8) {
        throw new Error("Наряд должен содержать ровно 8 бригад.");
      }

      const brigadeNumbers = crews.map((crew) => Number(crew.number ?? crew.id));
      const uniqueNumbers = new Set(brigadeNumbers);
      if (
        uniqueNumbers.size !== 8 ||
        brigadeNumbers.some((number) => !Number.isInteger(number) || number < 1 || number > 8)
      ) {
        throw new Error("Наряд должен содержать бригады №1–№8 без дубликатов.");
      }

      for (const crew of crews) {
        const members = Array.isArray(crew.members) ? crew.members : [];
        const paramedic = members.find(
          (member) => member.position === "paramedic" && member.staff_id
        );
        if (!paramedic) {
          throw new Error(
            "Нельзя сохранить наряд: в бригаде №" +
            Number(crew.number ?? crew.id) +
            " не определён фельдшер."
          );
        }
        if (members.some((member) => member.position === "paramedic" && !member.staff_id)) {
          throw new Error(
            "Нельзя сохранить наряд: не удалось определить одного из фельдшеров."
          );
        }
        if (members.some((member) => member.position === "driver" && !member.staff_id)) {
          throw new Error(
            "Нельзя сохранить наряд: не удалось определить одного из водителей."
          );
        }
      }

      const oldDutyDate = duties[0].duty_date || null;

      const dateConflicts = await request(
        "/rest/v1/duties?duty_date=eq." +
        encodeURIComponent(dutyDate) +
        "&id=neq." +
        encodeURIComponent(dutyId) +
        "&select=id",
        {},
        token
      );
      if (dateConflicts?.length) {
        throw new Error("На указанную дату уже существует другой наряд.");
      }

      const existingCrews = await request(
        "/rest/v1/duty_crews?duty_id=eq." +
        encodeURIComponent(dutyId) +
        "&select=id,brigade_number",
        {},
        token
      );

      const existingByNumber = new Map(
        (existingCrews || []).map((crew) => [Number(crew.brigade_number), crew.id])
      );

      const oldCrewIds = (existingCrews || []).map((crew) => crew.id);
      const oldMembers = oldCrewIds.length
        ? await request(
            "/rest/v1/duty_members?crew_id=in.(" +
            oldCrewIds.map(encodeURIComponent).join(",") +
            ")&select=crew_id,staff_id,position,shift,start_time,end_time",
            {},
            token
          )
        : [];

      const oldCrewMap = new Map(
        (existingCrews || []).map((crew) => [crew.id, Number(crew.brigade_number)])
      );

      const oldAssignments = (oldMembers || []).map((member) => ({
        crew_id: member.crew_id,
        staff_id: member.staff_id,
        position: member.position,
        shift: member.shift,
        start_time: member.start_time,
        end_time: member.end_time,
        brigade_number: oldCrewMap.get(member.crew_id)
      }));

      // ВАЖНО: сначала полностью подготавливаем новые данные.
      // Ни одна старая запись до этого места не удаляется.
      const preparedCrews = [];
      for (const crewData of crews) {
        const brigadeNumber = Number(crewData.number ?? crewData.id);
        let crewId = existingByNumber.get(brigadeNumber);

        if (!crewId) {
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

        if (!crewId) {
          throw new Error("Не удалось подготовить бригаду №" + brigadeNumber + ".");
        }

        const members = (crewData.members || []).map((item) => {
          if (!item.staff_id) {
            throw new Error(
              "Не удалось определить сотрудника в бригаде №" + brigadeNumber + "."
            );
          }
          return {
            crew_id: crewId,
            staff_id: item.staff_id,
            position: item.position,
            shift: item.shift,
            start_time: item.start_time,
            end_time: item.end_time
          };
        });

        preparedCrews.push({ brigadeNumber, crewId, members });
      }

      const rows = preparedCrews.flatMap((crew) => crew.members);
      const actualParamedics = rows.filter((row) => row.position === "paramedic").length;

      // В бригадах может быть разное количество фельдшеров:
      // часть бригад имеет двух фельдшеров, часть — одного.
      // Поэтому нельзя требовать ровно 8 фельдшеров на 8 бригад.
      // Выше уже проверено, что в каждой из 8 бригад есть хотя бы один
      // фельдшер с корректным staff_id.
      if (preparedCrews.length !== 8 || actualParamedics < 8 || rows.length === 0) {
        throw new Error(
          "Новый состав наряда не прошёл проверку: бригад " +
          preparedCrews.length +
          ", фельдшеров " +
          actualParamedics +
          ". Старый состав не изменён."
        );
      }

      try {
        // Обновляем сам наряд только после полной проверки нового состава.
        await request("/rest/v1/duties?id=eq." + encodeURIComponent(dutyId), {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            duty_date: dutyDate,
            dispatcher_id: dispatcherId
          })
        }, token);

        // Меняем только сотрудников. Старые duty_crews НЕ удаляем.
        if (oldCrewIds.length) {
          await request(
            "/rest/v1/duty_members?crew_id=in.(" +
            oldCrewIds.map(encodeURIComponent).join(",") +
            ")",
            { method: "DELETE" },
            token
          );
        }

        await request("/rest/v1/duty_members", {
          method: "POST",
          body: JSON.stringify(rows)
        }, token);

        const savedMembers = await request(
          "/rest/v1/duty_members?crew_id=in.(" +
          preparedCrews.map((crew) => encodeURIComponent(crew.crewId)).join(",") +
          ")&select=id,crew_id,staff_id,position,shift,start_time,end_time",
          {},
          token
        );

        if (!Array.isArray(savedMembers) || savedMembers.length !== rows.length) {
          throw new Error(
            "Состав наряда записан не полностью. Выполняется восстановление старого состава."
          );
        }

        // Если старые бригады были лишними, удаляем их только после успешной
        // проверки нового состава. При ошибке весь блок ниже попадёт в catch.
        const used = new Set(brigadeNumbers);
        const unusedCrewIds = (existingCrews || [])
          .filter((crew) => !used.has(Number(crew.brigade_number)))
          .map((crew) => crew.id);

        if (unusedCrewIds.length) {
          await request(
            "/rest/v1/duty_crews?id=in.(" +
            unusedCrewIds.map(encodeURIComponent).join(",") +
            ")",
            { method: "DELETE" },
            token
          );
        }
      } catch (error) {
        // REST-запросы не являются одной общей транзакцией.
        // Поэтому при ошибке возвращаем старых сотрудников вручную.
        try {
          await request(
            "/rest/v1/duty_members?crew_id=in.(" +
            preparedCrews.map((crew) => encodeURIComponent(crew.crewId)).join(",") +
            ")",
            { method: "DELETE" },
            token
          );

          if (oldAssignments.length) {
            await request("/rest/v1/duty_members", {
              method: "POST",
              body: JSON.stringify(
                oldAssignments.map((row) => ({
                  crew_id: row.crew_id,
                  staff_id: row.staff_id,
                  position: row.position,
                  shift: row.shift,
                  start_time: row.start_time,
                  end_time: row.end_time
                }))
              )
            }, token);
          }
        } catch (restoreError) {
          console.error("Не удалось автоматически восстановить старый состав:", restoreError);
        }

        throw error;
      }

      if (oldDutyDate === dutyDate) {
        try {
          await request("/functions/v1/telegram-duty-changes", {
            method: "POST",
            body: JSON.stringify({
              duty_id: dutyId,
              duty_date: dutyDate,
              old_members: oldAssignments.map((row) => ({
                staff_id: row.staff_id,
                position: row.position,
                shift: row.shift,
                start_time: row.start_time,
                end_time: row.end_time,
                brigade_number: row.brigade_number
              })),
              new_members: preparedCrews.flatMap((crew) =>
                crew.members.map((row) => ({
                  staff_id: row.staff_id,
                  position: row.position,
                  shift: row.shift,
                  start_time: row.start_time,
                  end_time: row.end_time,
                  brigade_number: crew.brigadeNumber
                }))
              )
            })
          }, token);
        } catch (e) {
          console.warn("Telegram duty change notification failed:", e);
        }
      }

      return {
        success: true,
        dutyId,
        oldDutyDate,
        crewCount: preparedCrews.length,
        memberCount: rows.length
      };
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
