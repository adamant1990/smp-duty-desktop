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

// Supabase REST по умолчанию возвращает не более 1000 строк за запрос.
// Загружаем назначения небольшими группами ID бригад, чтобы архив и
// редактирование старых нарядов не теряли сотрудников при большом объёме.
async function listDutyMembersByCrewIds(crewIds, token, select = "*") {
  const uniqueIds = [...new Set((crewIds || []).filter(Boolean))];
  if (!uniqueIds.length) return [];

  const chunkSize = 40;
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    chunks.push(uniqueIds.slice(i, i + chunkSize));
  }

  const results = await Promise.all(chunks.map((chunk) => {
    const ids = chunk.map(encodeURIComponent).join(",");
    return request(
      `/rest/v1/duty_members?crew_id=in.(${ids})&select=${select}`,
      {},
      token
    );
  }));

  return results.flat();
}

export async function signIn(email, password) {
  // При кратковременном обрыве сети автоматически повторяем вход один раз.
  // Ошибки логина/пароля (HTTP 400/401) повторять бессмысленно.
  const attempts = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const data = await request(
        "/auth/v1/token?grant_type=password",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
          signal: controller.signal
        }
      );
      saveSession(data);
      return data;
    } catch (error) {
      lastError = error;
      const retryable =
        error?.name === "AbortError" ||
        error instanceof TypeError ||
        !error?.status ||
        error.status === 429 ||
        error.status >= 500;

      if (!retryable || attempt === attempts) {
        if (error?.name === "AbortError") {
          throw new Error("Не удалось связаться с сервером авторизации. Проверьте интернет/VPN и повторите попытку.");
        }
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    // Небольшая пауза даёт сети время восстановиться перед повтором.
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  throw lastError || new Error("Не удалось выполнить вход.");
}

export async function restoreSession() {
  const stored = getSession();
  if (!stored?.access_token) return null;

  // Не держим окно входа бесконечно, если сеть или Supabase не отвечают.
  // AbortController также прерывает зависший запрос обновления токена.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const requestOptions = { signal: controller.signal };

  try {
    try {
      await request("/auth/v1/user", requestOptions, stored.access_token);
      return stored;
    } catch (error) {
      // При временной сетевой ошибке оставляем сохранённую сессию:
      // пользователь сможет повторить вход, когда соединение восстановится.
      if (error.status !== 401) return null;

      if (!stored.refresh_token) {
        clearSession();
        return null;
      }

      try {
        const refreshed = await request(
          "/auth/v1/token?grant_type=refresh_token",
          {
            ...requestOptions,
            method: "POST",
            body: JSON.stringify({ refresh_token: stored.refresh_token })
          }
        );
        saveSession(refreshed);
        return refreshed;
      } catch (refreshError) {
        // Удаляем сессию только если сервер явно отверг refresh-токен.
        // Тайм-аут, отсутствие интернета и ошибки сервера не должны
        // разлогинивать пользователя.
        if (refreshError.status === 400 || refreshError.status === 401) {
          clearSession();
        }
        return null;
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function signOut() {
  const stored = getSession();

  // Локальный выход не должен зависеть от доступности Supabase.
  // Токен сохраняем в переменной до очистки localStorage, чтобы при
  // необходимости отправить серверный logout в фоне.
  clearSession();

  if (stored?.access_token) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    request(
      "/auth/v1/logout",
      { method: "POST", signal: controller.signal },
      stored.access_token
    )
      .catch(() => {
        // Серверный logout необязателен для локального завершения сессии.
      })
      .finally(() => clearTimeout(timeout));
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

    listAll: (token) =>
      request("/rest/v1/staff?select=*&order=full_name.asc", {}, token),

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
    updateFull: async (dutyId, dutyDate, dispatcherId, crews, token, allowPastEdit = false) => {
      const duties = await request(
        "/rest/v1/duties?id=eq." + encodeURIComponent(dutyId) + "&select=id,duty_date",
        {},
        token
      );

      if (!duties?.[0]) throw new Error("Наряд не найден.");
      if (!allowPastEdit && dutyDate < new Date().toLocaleDateString("en-CA")) {
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
        // Фельдшер в бригаде может отсутствовать: это допустимо при нехватке
        // сотрудников. Но если фельдшер указан, его ID должен быть определён.
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

      // Бригада без фельдшера допустима: нехватка фельдшеров не должна
      // блокировать редактирование и сохранение наряда.
      if (preparedCrews.length !== 8) {
        throw new Error(
          "Новый состав наряда не прошёл проверку. Старый состав не изменён."
        );
      }

      // One database transaction replaces the complete assignment set.
      // The duty row lock serializes concurrent saves of the same duty.
      const atomicResult = await request("/rest/v1/rpc/admin_replace_duty_members", {
        method: "POST",
        body: JSON.stringify({
          p_duty_id: dutyId,
          p_duty_date: dutyDate,
          p_dispatcher_id: dispatcherId,
          p_members: rows
        })
      }, token);

      // Notify only when the database confirms that this save changed data.
      // Repeated identical saves become no-ops after the first transaction.
      if (
        atomicResult?.changed &&
        atomicResult?.old_duty_date === dutyDate
      ) {
        try {
          await request("/functions/v1/telegram-duty-changes", {
            method: "POST",
            body: JSON.stringify({
              duty_id: dutyId,
              duty_date: dutyDate,
              old_members: atomicResult.old_members || [],
              new_members: atomicResult.new_members || []
            })
          }, token);
        } catch (e) {
          console.warn("Telegram duty change notification failed:", e);
        }
      }

      return {
        success: true,
        dutyId,
        oldDutyDate: atomicResult?.old_duty_date ?? null,
        changed: Boolean(atomicResult?.changed),
        crewCount: atomicResult?.crew_count ?? preparedCrews.length,
        memberCount: atomicResult?.member_count ?? rows.length
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
  audit: {
    dutyHistory: (dutyId, token) =>
      request("/rest/v1/rpc/admin_duty_audit_history", {
        method: "POST",
        body: JSON.stringify({ p_duty_id: dutyId })
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
    list: (crewIds, token) =>
      listDutyMembersByCrewIds(crewIds, token),

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
