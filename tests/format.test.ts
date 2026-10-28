import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  fmtDate,
  fmtDateTime,
  fmtSize,
  pacificLocalToISO,
  fmtRelative,
  fmtShortDay,
} from "../lib/format.ts";

// ICU puts a narrow no-break space before AM/PM; normalize so assertions stay readable.
const plain = (s: string) => s.replace(/ /g, " ");

describe("fmtDate", () => {
  it("returns empty string for missing values", () => {
    assert.equal(fmtDate(null), "");
    assert.equal(fmtDate(undefined), "");
    assert.equal(fmtDate(""), "");
  });

  it("keeps date-only strings on the same calendar day", () => {
    assert.equal(fmtDate("2026-10-28"), "Oct 28, 2026");
    assert.equal(fmtDate("2026-01-01"), "Jan 1, 2026");
    assert.equal(fmtDate("2026-12-31"), "Dec 31, 2026");
  });

  it("shows timestamps on the Pacific calendar day", () => {
    // 05:00 UTC on Oct 29 is 10 PM Oct 28 in Pacific time.
    assert.equal(fmtDate("2026-10-29T05:00:00Z"), "Oct 28, 2026");
    assert.equal(fmtDate(new Date("2026-10-29T08:00:00Z")), "Oct 29, 2026");
  });
});

describe("fmtDateTime", () => {
  it("shows Pacific time with the daylight zone label", () => {
    assert.equal(
      plain(fmtDateTime("2026-10-28T17:30:00Z")),
      "Wed, Oct 28, 2026, 10:30 AM PDT",
    );
  });

  it("shows Pacific time with the standard zone label in winter", () => {
    assert.equal(
      plain(fmtDateTime("2026-01-15T17:00:00Z")),
      "Thu, Jan 15, 2026, 9:00 AM PST",
    );
  });
});

describe("fmtSize", () => {
  it("formats bytes, kilobytes and megabytes", () => {
    assert.equal(fmtSize(0), "0 B");
    assert.equal(fmtSize(1023), "1023 B");
    assert.equal(fmtSize(1024), "1 KB");
    assert.equal(fmtSize(500 * 1024), "500 KB");
    assert.equal(fmtSize(1024 * 1024), "1.0 MB");
    assert.equal(fmtSize(25 * 1024 * 1024), "25.0 MB");
  });
});

describe("pacificLocalToISO", () => {
  it("converts summer times using PDT (UTC-7)", () => {
    assert.equal(
      pacificLocalToISO("2026-07-01T09:00"),
      "2026-07-01T16:00:00.000Z",
    );
  });

  it("converts winter times using PST (UTC-8)", () => {
    assert.equal(
      pacificLocalToISO("2026-01-15T09:00"),
      "2026-01-15T17:00:00.000Z",
    );
  });

  it("handles times that cross midnight UTC", () => {
    assert.equal(
      pacificLocalToISO("2026-10-28T20:30"),
      "2026-10-29T03:30:00.000Z",
    );
  });

  it("round-trips with fmtDateTime", () => {
    const iso = pacificLocalToISO("2026-10-28T10:30");
    assert.equal(plain(fmtDateTime(iso)), "Wed, Oct 28, 2026, 10:30 AM PDT");
  });

  it("falls back to PST for a time skipped by the spring clock change", () => {
    assert.equal(
      pacificLocalToISO("2026-03-08T02:30"),
      "2026-03-08T10:30:00.000Z",
    );
  });
});

describe("fmtRelative", () => {
  afterEach(() => mock.timers.reset());

  // Noon Pacific on Wed Oct 28, 2026.
  const freeze = () =>
    mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-10-28T19:00:00Z"),
    });

  it("returns empty string for missing values", () => {
    assert.equal(fmtRelative(null), "");
    assert.equal(fmtRelative(undefined), "");
  });

  it("describes nearby days in words", () => {
    freeze();
    assert.equal(fmtRelative("2026-10-28"), "today");
    assert.equal(fmtRelative("2026-10-29"), "tomorrow");
    assert.equal(fmtRelative("2026-10-27"), "yesterday");
    assert.equal(fmtRelative("2026-10-31"), "in 3 days");
    assert.equal(fmtRelative("2026-10-26"), "2 days ago");
  });

  it("returns empty string a month or more away", () => {
    freeze();
    assert.equal(fmtRelative("2026-11-28"), "");
    assert.equal(fmtRelative("2026-09-27"), "");
  });

  it("compares timestamps by Pacific calendar day", () => {
    freeze();
    // 06:00 UTC Oct 29 is still Oct 28 in Pacific time.
    assert.equal(fmtRelative("2026-10-29T06:00:00Z"), "today");
    assert.equal(fmtRelative("2026-10-29T08:00:00Z"), "tomorrow");
  });
});

describe("fmtShortDay", () => {
  it("returns empty string for missing values", () => {
    assert.equal(fmtShortDay(null), "");
  });

  it("formats date-only strings without shifting the day", () => {
    assert.equal(fmtShortDay("2026-10-29"), "Thu, Oct 29");
  });

  it("formats timestamps on the Pacific calendar day", () => {
    assert.equal(fmtShortDay("2026-10-30T05:00:00Z"), "Thu, Oct 29");
  });
});
