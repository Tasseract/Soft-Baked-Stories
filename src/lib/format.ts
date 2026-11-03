export const TZ = "Asia/Manila";

export const when = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

// YYYY-MM-DD in Manila time
export const dayKey = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
