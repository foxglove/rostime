import * as rostime from ".";

describe("timeUtils", () => {
  it("isTime", () => {
    expect(rostime.isTime(undefined)).toEqual(false);
    expect(rostime.isTime(false)).toEqual(false);
    expect(rostime.isTime(true)).toEqual(false);
    expect(rostime.isTime({})).toEqual(false);
    expect(rostime.isTime({ sec: 1 })).toEqual(false);
    expect(rostime.isTime({ nsec: 1 })).toEqual(false);
    expect(rostime.isTime({ sec: 1, nsec: 1, other: undefined })).toEqual(false);
    expect(rostime.isTime({ sec: 1, nsec: 1, other: 0 })).toEqual(false);

    expect(rostime.isTime({ sec: 0, nsec: 0 })).toEqual(true);
    expect(rostime.isTime({ sec: 1, nsec: 0 })).toEqual(true);
    expect(rostime.isTime({ sec: 1624947142, nsec: 42 })).toEqual(true);
  });
});

describe("toString", () => {
  it("formats whole values correction", () => {
    expect(rostime.toString({ sec: 1, nsec: 0 })).toEqual("1.000000000");
  });

  it("formats partial nanos", () => {
    expect(rostime.toString({ sec: 102, nsec: 304 })).toEqual("102.000000304");
    expect(rostime.toString({ sec: 102, nsec: 99900000 })).toEqual("102.099900000");
  });

  it("formats max nanos", () => {
    expect(rostime.toString({ sec: 102, nsec: 999000000 })).toEqual("102.999000000");
  });

  it("does not format negative times", () => {
    expect(() => rostime.toString({ sec: -1, nsec: 0 })).toThrow();
  });
});

describe("fromString", () => {
  it("converts from nanoseconds to time", () => {
    const nanos1 = "1508410740.582458241";
    expect(rostime.fromString(nanos1)).toEqual({ sec: 1508410740, nsec: 582458241 });
    const nanos2 = "1508428043.155306000";
    expect(rostime.fromString(nanos2)).toEqual({ sec: 1508428043, nsec: 155306000 });
    expect(rostime.fromString("5001")).toEqual({ sec: 5001, nsec: 0 });
    const nanos3 = `${1e10 + 1}`;
    expect(rostime.fromString(nanos3)).toEqual({ sec: 1e10 + 1, nsec: 0 });
    expect(rostime.fromString("0")).toEqual({ sec: 0, nsec: 0 });
    expect(rostime.fromString("1000.000")).toEqual({ sec: 1000, nsec: 0 });
  });

  it("does not convert invalid times", () => {
    expect(rostime.fromString("1000x00")).toBeUndefined();
    expect(rostime.fromString("1000 00")).toBeUndefined();
    expect(rostime.fromString("")).toBeUndefined();
    expect(rostime.fromString("-1")).toBeUndefined();
  });
});

// toDate

// fromDate

// percentOf

// interpolate

// fixTime

// add

// subtract

// toNanoSec

// toMicroSec

// toSec

// fromSec

// fromNanoSec

// toMillis

// fromMillis

// fromMicros

// clampTime

// isTimeInRangeInclusive

// compare

// isLessThan

// isGreaterThan

// areEqual
