export function manualSchedule(
  options: {
    startDate: string;
    times: string;
    quantity: number;
    dailyLimit: number;
    intervalMinutes: number;
  },
  now = Date.now(),
) {
  const { quantity, dailyLimit, intervalMinutes } = options;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)
    throw new Error("Escolha de 1 a 100 publicações.");
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10)
    throw new Error("O limite diário deve ficar entre 1 e 10.");
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440)
    throw new Error("Escolha um intervalo entre 1 e 1440 minutos.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.startDate))
    throw new Error("Informe uma data válida para começar.");
  const [year, month, day] = options.startDate.split("-").map(Number),
    base = new Date(year, month - 1, day, 12);
  if (base.getFullYear() !== year || base.getMonth() !== month - 1 || base.getDate() !== day)
    throw new Error("A data informada não existe.");
  const slots = options.times.split(",").map((value) => value.trim());
  if (!slots.length || slots.some((value) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))
    throw new Error("Use horários válidos separados por vírgula, como 09:00, 13:00.");
  if (new Set(slots).size !== slots.length) throw new Error("Remova os horários repetidos.");
  slots.sort();
  const perDay = Math.min(dailyLimit, slots.length);
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  for (let index = 1; index < perDay; index++)
    if (minutes(slots[index]) - minutes(slots[index - 1]) < intervalMinutes)
      throw new Error("Os horários estão próximos demais para o intervalo mínimo escolhido.");
  // Check the overnight gap as well; only actually used slots participate.
  if (quantity > perDay && 1440 - minutes(slots[perDay - 1]) + minutes(slots[0]) < intervalMinutes)
    throw new Error(
      "O intervalo entre o último horário de um dia e o primeiro do seguinte é muito curto.",
    );
  return Array.from({ length: quantity }, (_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + Math.floor(index / perDay));
    const time = slots[index % perDay];
    const [hour, minute] = time.split(":").map(Number);
    const scheduled = new Date(date);
    scheduled.setHours(hour, minute, 0, 0);
    if (scheduled.getTime() <= now)
      throw new Error("Escolha apenas datas e horários futuros para a prévia.");
    return { date: date.toLocaleDateString("pt-BR"), time };
  });
}
