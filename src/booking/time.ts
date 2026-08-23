import * as chrono from "chrono-node";

const MAX_ADVANCE_DAYS = 90;

export interface ParsedBookingTime {
  instant: Date;
  displayText: string;
}

function timezoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return Math.round((representedAsUtc - instant.getTime()) / 60_000);
}

export function parseRequestedBookingTime(
  messageText: string,
  receivedAt: Date,
  timeZone: string,
): ParsedBookingTime | null {
  const referenceOffset = timezoneOffsetMinutes(timeZone, receivedAt);
  const result = chrono.casual.parse(
    messageText,
    { instant: receivedAt, timezone: referenceOffset },
    { forwardDate: true },
  )[0];

  if (
    !result ||
    !result.start.isCertain("hour") ||
    (!result.start.isCertain("day") &&
      !result.start.isCertain("weekday") &&
      !result.start.isCertain("month"))
  ) {
    return null;
  }

  const instant = result.start.date();
  const latestAllowed = new Date(
    receivedAt.getTime() + MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1_000,
  );

  if (instant <= receivedAt || instant > latestAllowed) {
    return null;
  }

  return {
    instant,
    displayText: new Intl.DateTimeFormat("en-AE", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(instant),
  };
}
