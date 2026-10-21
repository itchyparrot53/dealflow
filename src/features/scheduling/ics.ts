// RFC 5545 calendar for a confirmed booking. Deliberately hand-rolled: the only consumer is a
// mail client or a downloaded file, the shape is fixed, and a library would add a dependency for
// one fixed template. Line folding is measured in octets, not characters, per the RFC.

export interface IcsInput {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location: string;
  organizerName: string;
  organizerEmail: string;
  /** DTSTAMP, the moment the object was created. Defaults to now; tests pin it. */
  now?: Date;
}

const CRLF = "\r\n";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function utcStamp(at: Date): string {
  return (
    `${at.getUTCFullYear()}${pad2(at.getUTCMonth() + 1)}${pad2(at.getUTCDate())}` +
    `T${pad2(at.getUTCHours())}${pad2(at.getUTCMinutes())}${pad2(at.getUTCSeconds())}Z`
  );
}

// RFC 5545 TEXT escaping: backslash first, then the three structural characters.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// 75 octets per physical line. A continuation line begins with one space, so its payload is 74.
function foldLine(line: string): string {
  const chars = [...line];
  const lines: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of chars) {
    const charBytes = Buffer.byteLength(char, "utf8");
    const limit = lines.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      lines.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  lines.push(current);
  return lines.join(`${CRLF} `);
}

export function buildIcs(input: IcsInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dealflow//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${utcStamp(input.now ?? new Date())}`,
    `DTSTART:${utcStamp(input.start)}`,
    `DTEND:${utcStamp(input.end)}`,
    `SUMMARY:${escapeText(input.summary)}`,
  ];
  if (input.description.trim() !== "") lines.push(`DESCRIPTION:${escapeText(input.description)}`);
  if (input.location.trim() !== "") lines.push(`LOCATION:${escapeText(input.location)}`);
  // A header value cannot carry a line break; strip any before it reaches mailto:.
  const organizerEmail = input.organizerEmail.replace(/[\r\n]/g, "");
  lines.push(
    `ORGANIZER;CN=${escapeText(input.organizerName)}:mailto:${organizerEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.map(foldLine).join(CRLF) + CRLF;
}
