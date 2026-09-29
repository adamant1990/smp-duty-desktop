export const uid = () => crypto.randomUUID();

export const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA");
};

export const shiftTimes = (shift, start, end) => {
  if (shift === "24") return { start: "08:00", end: "08:00" };
  if (shift === "day") return { start: "08:00", end: "20:00" };
  if (shift === "night") return { start: "20:00", end: "08:00" };
  return { start: start || "08:00", end: end || "16:00" };
};

export const newCrew = (number) => ({
  id: number,
  paramedics: [{ id: uid(), name: "", shift: "24", start_time: "08:00", end_time: "08:00" }],
  drivers: [
    { id: uid(), name: "", shift: "day", start_time: "08:00", end_time: "20:00" },
    { id: uid(), name: "", shift: "night", start_time: "20:00", end_time: "08:00" }
  ]
});

export const newCrews = () => Array.from({ length: 8 }, (_, i) => newCrew(i + 1));

export const formatDutyDate = value => new Date(value + "T00:00:00").toLocaleDateString("ru-RU", {
  day: "2-digit", month: "2-digit", year: "numeric"
});

export const formatDay = value => new Date(value + "T00:00:00").toLocaleDateString("ru-RU", {
  weekday: "long"
});