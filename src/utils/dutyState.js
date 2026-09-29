import { uid, shiftTimes } from "./duty";
import { intervalsOverlap } from "./shiftIntervals";

export const cloneCrewsForForm = crews => (crews || []).map(crew => ({
  ...crew,
  paramedics: (crew.paramedics || []).map(p => ({ ...p, id: uid(), ...shiftTimes(p.shift, p.start_time, p.end_time) })),
  drivers: (crew.drivers || []).map(p => ({ ...p, id: uid(), ...shiftTimes(p.shift, p.start_time, p.end_time) }))
}));

export const getAssignmentWarnings = crews => {
  const assigned = new Map();
  const warnings = [];
  for (const crew of crews || []) {
    for (const person of [...(crew.paramedics || []), ...(crew.drivers || [])]) {
      if (!person.name) continue;
      const previous = assigned.get(person.staffId || person.name) || [];
      previous.forEach(item => {
        if (intervalsOverlap(item.start_time, item.end_time, person.start_time, person.end_time)) {
          warnings.push(person.name + ": бригады №" + item.crewId + " и №" + crew.id);
        }
      });
      assigned.set(person.staffId || person.name, [...previous, {
        crewId: crew.id, start_time: person.start_time, end_time: person.end_time
      }]);
    }
  }
  return [...new Set(warnings)];
};