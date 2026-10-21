import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

const NOW = new Date("2026-10-21T09:00:00Z");
const START = new Date("2026-10-22T10:00:00Z");
const END = new Date("2026-10-22T10:30:00Z");

describe("buildIcs", () => {
  it("renders an exact RFC 5545 calendar", () => {
    const ics = buildIcs({
      uid: "booking-1@dealflow",
      start: START,
      end: END,
      summary: "Intro call with Sam Ortiz",
      description: "Bring notes, please.\nSecond line",
      location: "Online; link in email",
      organizerName: "Ada Lovelace",
      organizerEmail: "ada@example.com",
      now: NOW,
    });

    expect(ics).toBe(
      "BEGIN:VCALENDAR\r\n" +
        "VERSION:2.0\r\n" +
        "PRODID:-//Dealflow//Booking//EN\r\n" +
        "CALSCALE:GREGORIAN\r\n" +
        "METHOD:PUBLISH\r\n" +
        "BEGIN:VEVENT\r\n" +
        "UID:booking-1@dealflow\r\n" +
        "DTSTAMP:20261021T090000Z\r\n" +
        "DTSTART:20261022T100000Z\r\n" +
        "DTEND:20261022T103000Z\r\n" +
        "SUMMARY:Intro call with Sam Ortiz\r\n" +
        "DESCRIPTION:Bring notes\\, please.\\nSecond line\r\n" +
        "LOCATION:Online\\; link in email\r\n" +
        "ORGANIZER;CN=Ada Lovelace:mailto:ada@example.com\r\n" +
        "END:VEVENT\r\n" +
        "END:VCALENDAR\r\n",
    );
  });

  it("omits an empty description and location", () => {
    const ics = buildIcs({
      uid: "booking-2@dealflow",
      start: START,
      end: END,
      summary: "Intro call",
      description: "",
      location: "",
      organizerName: "Ada Lovelace",
      organizerEmail: "ada@example.com",
      now: NOW,
    });
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("escapes backslashes and semicolons in text and names", () => {
    const ics = buildIcs({
      uid: "booking-3@dealflow",
      start: START,
      end: END,
      summary: "Path C:\\temp",
      description: "",
      location: "",
      organizerName: "Ada; Lovelace",
      organizerEmail: "ada@example.com",
      now: NOW,
    });
    expect(ics).toContain("SUMMARY:Path C:\\\\temp\r\n");
    expect(ics).toContain("ORGANIZER;CN=Ada\\; Lovelace:mailto:ada@example.com\r\n");
  });

  it("folds a long line at 75 octets and unfolds back to the original", () => {
    const summary = "x".repeat(160);
    const ics = buildIcs({
      uid: "booking-4@dealflow",
      start: START,
      end: END,
      summary,
      description: "",
      location: "",
      organizerName: "Ada Lovelace",
      organizerEmail: "ada@example.com",
      now: NOW,
    });

    const physical = ics.split("\r\n");
    for (const line of physical) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }

    const unfolded = ics.replace(/\r\n /g, "").split("\r\n");
    expect(unfolded).toContain(`SUMMARY:${summary}`);
  });

  it("uses CRLF for every line break", () => {
    const ics = buildIcs({
      uid: "booking-5@dealflow",
      start: START,
      end: END,
      summary: "Intro call",
      description: "Line one\nLine two",
      location: "Room 1",
      organizerName: "Ada Lovelace",
      organizerEmail: "ada@example.com",
      now: NOW,
    });
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(ics.endsWith("\r\n")).toBe(true);
  });
});
