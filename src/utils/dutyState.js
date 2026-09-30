import { uid, shiftTimes } from "./duty";
import { intervalsOverlap } from "./shiftIntervals";

export const cloneCrewsForForm = crews => (crews || []).map(crew => {
  const drivers = (crew.drivers || []).map(p => ({
    ...p,
    id: uid(),
    staffId: p.staffId || p.staff_id || null,
    ...shiftTimes(p.shift, p.start_time, p.end_time)
  }));

  // Даже если в сохранённом наряде водителей не было (например,
  // наряд был создан из Excel только с фельдшерами), при редактировании
  // должны оставаться две пустые строки для водителей: день и ночь.
  while (drivers.length < 2) {
    const night = drivers.length === 1;
    drivers.push({
      id: uid(),
      name: "",
      shift: night ? "night" : "day",
      start_time: night ? "20:00" : "08:00",
      end_time: night ? "08:00" : "20:00"
    });
  }

  return {
    ...crew,
    paramedics: (crew.paramedics || []).map(p => ({
      ...p,
      id: uid(),
      staffId: p.staffId || p.staff_id || null,
      ...shiftTimes(p.shift, p.start_time, p.end_time)
    })),
    drivers
  };
});

const normalizeName = value => String(value || "").trim().toLowerCase();

const getInterval = person => {
  const times = shiftTimes(person?.shift, person?.start_time, person?.end_time);
  return {
    start_time: times.start,
    end_time: times.end
  };
};

export const getAssignmentWarnings = crews => {
  const assigned = new Map();
  const warnings = [];

  for (const crew of crews || []) {
    for (const person of [...(crew.paramedics || []), ...(crew.drivers || [])]) {
      const name = String(person?.name || "").trim();
      if (!name) continue;

      const key = person.staffId || person.staff_id || normalizeName(name);
      const interval = getInterval(person);
      const previous = assigned.get(key) || [];

      previous.forEach(item => {
        if (item.crewId === crew.id) return;

        if (intervalsOverlap(
          item.start_time,
          item.end_time,
          interval.start_time,
          interval.end_time
        )) {
          warnings.push(
            name + ": бригады №" + item.crewId + " и №" + crew.id
          );
        }
      });

      assigned.set(key, [
        ...previous,
        {
          crewId: crew.id,
          start_time: interval.start_time,
          end_time: interval.end_time
        }
      ]);
    }
  }

  return [...new Set(warnings)];
};
