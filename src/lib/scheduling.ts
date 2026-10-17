export function zonedDateTimeToIso(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = targetUtc;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
    );
    const displayedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    candidate += targetUtc - displayedUtc;
  }
  const verified = Object.fromEntries(
    formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
  );
  if (
    Number(verified.year) !== year ||
    Number(verified.month) !== month ||
    Number(verified.day) !== day ||
    Number(verified.hour) !== hour ||
    Number(verified.minute) !== minute
  ) {
    throw new Error("Este horário não existe no fuso horário escolhido.");
  }
  return new Date(candidate).toISOString();
}
