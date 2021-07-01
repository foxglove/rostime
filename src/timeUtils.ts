// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

// No time functions that require `moment` should live in this file.
import { Time } from "./Time";

/**
 * Test if a given object matches the signature of { sec: number; nsec: number }
 * @param obj Object to test
 * @returns True if the object is equivalent to a Time object, otherwise false
 */
export function isTime(obj?: unknown): obj is Time {
  return (
    typeof obj === "object" &&
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    !!obj &&
    "sec" in obj &&
    "nsec" in obj &&
    Object.getOwnPropertyNames(obj).length === 2
  );
}

/**
 * Converts a Time to a string containing a floating point number of seconds
 * @param stamp Time to convert
 * @param allowNegative Allow negative times to be converted
 * @returns String timestamp containing a floating point number of seconds
 */
export function toString(stamp: Time, allowNegative = false): string {
  if (!allowNegative && (stamp.sec < 0 || stamp.nsec < 0)) {
    throw new Error(`Invalid negative time { sec: ${stamp.sec}, nsec: ${stamp.nsec} }`);
  }
  const sec = Math.floor(stamp.sec);
  const nsec = Math.floor(stamp.nsec);
  return `${sec}.${nsec.toFixed().padStart(9, "0")}`;
}

const DIGITS_WITHOUT_DECIMAL_POINT_RE = /^\d+$/;
const DIGITS_WITH_DECIMAL_POINT_RE = /^(?!\.$)(\d*)\.(\d*)$/;
const THOUSAND_YEARS_IN_NANOSEC = 1000n * 365n * 24n * 60n * 60n * BigInt(1e9);

/**
 * Converts a string containing floating point number of seconds to a Time.
 * @param stamp UNIX timestamp containing a whole or floating point number of seconds. If more than
 * 9 digits of nanoseconds are given, the rest will be truncated.
 * @param options.fuzzy Try to be more lenient in parsing: if the numeric value given is too large
 * and contains no decimal point, assume it is ms, µs, ns instead of seconds (or a smaller unit, in
 * powers of 1000).
 * @returns Time object on success, undefined on failure
 */
export function fromString(
  stamp: string,
  { fuzzy = false }: { fuzzy?: boolean } = {},
): Time | undefined {
  stamp = stamp.trim();
  if (DIGITS_WITHOUT_DECIMAL_POINT_RE.test(stamp)) {
    // Start by assuming the input is in seconds, and convert to nanoseconds.
    let nanos = BigInt(stamp) * BigInt(1e9);
    if (fuzzy) {
      while (nanos > THOUSAND_YEARS_IN_NANOSEC) {
        nanos /= 1000n;
      }
    }
    return { sec: Number(nanos / BigInt(1e9)), nsec: Number(nanos % BigInt(1e9)) };
  }

  const match = DIGITS_WITH_DECIMAL_POINT_RE.exec(stamp);
  if (match?.[1] != undefined && match[2] != undefined) {
    // There can be at most 9 digits of nanoseconds. Truncate any others.
    return { sec: Number(match[1]), nsec: Number(match[2].substr(0, 9).padEnd(9, "0")) };
  }

  return undefined;
}

/**
 * Convert a Time to a JavaScript Date object. NOTE: sub-millisecond precision is lost.
 * @param stamp Time to convert
 * @returns Date representing the given Time as accurately as it can
 */
export function toDate(stamp: Time): Date {
  const { sec, nsec } = stamp;
  return new Date(sec * 1000 + nsec / 1e6);
}

/**
 * Conver a JavaScript Date object to a Time.
 * @param date Date to convert
 * @returns Time representing the given Date
 */
export function fromDate(date: Date): Time {
  const millis = date.getTime();
  const remainder = millis % 1000;
  return { sec: Math.floor(millis / 1000), nsec: remainder * 1e6 };
}

/**
 * Returns the fraction representing target's position in the range between start and end.
 * e.g. start = { sec: 0 }, end = { sec: 10 }, target = { sec: 5 } = 0.5
 * This is the reverse of the `interpolate()` method
 * @param start Start timestamp of the interpolation range
 * @param end End timestamp of the interpolation range
 * @param target Timestamp that will be measured relative to the interpolation range
 * @returns If target falls in between start and end (inclusive), it will be in the range [0.0-1.0].
 *   Otherwise, it is unbounded
 */
export function percentOf(start: Time, end: Time, target: Time): number {
  const totalDuration = subtract(end, start);
  const targetDuration = subtract(target, start);
  return toSec(targetDuration) / toSec(totalDuration);
}

/**
 * Linearly interpolate the range between start and end by a given fraction.
 * e.g. start = { sec: 0 }, end = { sec: 10 }, fraction = 0.5 = { sec: 5 }
 * This is the reverse of the `percentOf` method
 * @param start Start timestamp of the interpolation range
 * @param end End timestamp of the interpolation range
 * @param fraction Percent to interpolate along the range
 * @returns If fraction is in the range [0.0-1.0], the target will fall in between start and end\
 *   (inclusive). Otherwise, it is unbounded
 */
export function interpolate(start: Time, end: Time, fraction: number): Time {
  const duration = subtract(end, start);
  return add(start, fromSec(fraction * toSec(duration)));
}

/**
 * Equivalent to fromNanoSec(toNanoSec(t)), but no chance of precision loss. nsec should be
 * non-negative, and less than 1e9.
 * @param t Potentially un-normalized time with the nsec (nanoseconds) value containing a value
 *   higher than one second (1e9)
 * @param allowNegative Allow negative times to be normalized
 * @returns A normalized Time
 */
export function fixTime(t: Time, allowNegative = false): Time {
  const durationNanos = t.nsec;
  const secsFromNanos = Math.floor(durationNanos / 1e9);
  const newSecs = t.sec + secsFromNanos;
  const remainingDurationNanos = durationNanos % 1e9;
  // use Math.abs here to prevent -0 when there is exactly 1 second of negative nanoseconds passed in
  const newNanos = Math.abs(
    Math.sign(remainingDurationNanos) === -1
      ? 1e9 + remainingDurationNanos
      : remainingDurationNanos,
  );
  const result = { sec: newSecs, nsec: newNanos };
  if ((!allowNegative && result.sec < 0) || result.nsec < 0) {
    throw new Error(`Cannot normalize invalid time ${toString(result, true)}`);
  }
  return result;
}

/**
 * Add two Times together
 * @param param0 First Time
 * @param param1 Second Time
 * @returns A normalized representation of the two Time objects added together
 */
export function add({ sec: sec1, nsec: nsec1 }: Time, { sec: sec2, nsec: nsec2 }: Time): Time {
  return fixTime({ sec: sec1 + sec2, nsec: nsec1 + nsec2 });
}

/**
 * Subtract one Time from another
 * @param param0 First Time
 * @param param1 Time to subtract from the first Time
 * @returns A normalized representation of the second Time subtracted from the first
 */
export function subtract({ sec: sec1, nsec: nsec1 }: Time, { sec: sec2, nsec: nsec2 }: Time): Time {
  return fixTime({ sec: sec1 - sec2, nsec: nsec1 - nsec2 }, true);
}

/**
 * Convert Time to an integer number of nanoseconds
 * @param param0 Time to convert
 * @returns A bigint integer number of nanoseconds
 */
export function toNanoSec({ sec, nsec }: Time): bigint {
  return BigInt(sec) * BigInt(1e9) + BigInt(nsec);
}

/**
 * Convert Time to a floating point number of microseconds
 * @param param0 Time to convert
 * @returns A floating point number of microseconds
 */
export function toMicroSec({ sec, nsec }: Time): number {
  return (sec * 1e9 + nsec) / 1000;
}

/**
 * Convert Time to a floating point number of seconds
 * @param param0 Time to convert
 * @returns A floating point number of seconds
 */
export function toSec({ sec, nsec }: Time): number {
  return sec + nsec * 1e-9;
}

/**
 * Convert a floating point number of seconds to Time
 * @param value Number of seconds
 * @returns Time object
 */
export function fromSec(value: number): Time {
  // From https://github.com/ros/roscpp_core/blob/indigo-devel/rostime/include/ros/time.h#L153
  let sec = Math.trunc(value);
  let nsec = Math.round((value - sec) * 1e9);
  sec += Math.trunc(nsec / 1e9);
  nsec %= 1e9;
  return { sec, nsec };
}

/**
 * Convert an integer number of nanoseconds to Time
 * @param nsec Nanoseconds integer
 * @returns Time object
 */
export function fromNanoSec(nsec: bigint): Time {
  // From https://github.com/ros/roscpp_core/blob/86720717c0e1200234cc0a3545a255b60fb541ec/rostime/include/ros/impl/time.h#L63
  // and https://github.com/ros/roscpp_core/blob/7583b7d38c6e1c2e8623f6d98559c483f7a64c83/rostime/src/time.cpp#L536
  return { sec: Math.trunc(Number(nsec / BigInt(1e9))), nsec: Number(nsec % BigInt(1e9)) };
}

/**
 * Convert Time to an integer number of milliseconds
 * @param time Time to convert
 * @param roundUp Round up to nearest millisecond if true, otherwise round down. Defaults to true
 * @returns Integer number of milliseconds
 */
export function toMillis(time: Time, roundUp = true): number {
  const secondsMillis = time.sec * 1e3;
  const nsecMillis = time.nsec / 1e6;
  return roundUp ? secondsMillis + Math.ceil(nsecMillis) : secondsMillis + Math.floor(nsecMillis);
}

/**
 * Convert milliseconds to Time
 * @param value Milliseconds number
 * @returns Time object
 */
export function fromMillis(value: number): Time {
  let sec = Math.trunc(value / 1000);
  let nsec = Math.round((value - sec * 1000) * 1e6);
  sec += Math.trunc(nsec / 1e9);
  nsec %= 1e9;
  return { sec, nsec };
}

/**
 * Convert microseconds to Time
 * @param value Microseconds number
 * @returns Time object
 */
export function fromMicros(value: number): Time {
  let sec = Math.trunc(value / 1e6);
  let nsec = Math.round((value - sec * 1e6) * 1e3);
  sec += Math.trunc(nsec / 1e9);
  nsec %= 1e9;
  return { sec, nsec };
}

/**
 * Clamp a given time value in the range from start to end (inclusive)
 * @param time Time to clamp
 * @param start Start of the target range
 * @param end End of the target range
 * @returns Clamped Time
 */
export function clampTime(time: Time, start: Time, end: Time): Time {
  if (compare(start, time) > 0) {
    return { sec: start.sec, nsec: start.nsec };
  }
  if (compare(end, time) < 0) {
    return { sec: end.sec, nsec: end.nsec };
  }
  return { sec: time.sec, nsec: time.nsec };
}

/**
 * Test if a given time is inside a test range
 * @param time Time to test
 * @param start Start of the test range
 * @param end End of the test range
 * @returns True if time falls in between start and end (inclusive)
 */
export function isTimeInRangeInclusive(time: Time, start: Time, end: Time): boolean {
  if (compare(start, time) > 0 || compare(end, time) < 0) {
    return false;
  }
  return true;
}

/**
 * Comparison function for Time object that can be used for sorting
 * @param left First Time to compare
 * @param right Second Time to compare
 * @returns A positive value if left is larger than right, a negative value if right is larger than
 *   left, or zero if both times are equal
 */
export function compare(left: Time, right: Time): number {
  const secDiff = left.sec - right.sec;
  return secDiff !== 0 ? secDiff : left.nsec - right.nsec;
}

/**
 * Returns true if the left time is less than the right time, otherwise false
 * @param left Left side of comparison
 * @param right Right side of comparison
 * @returns Comparison result
 */
export function isLessThan(left: Time, right: Time): boolean {
  return compare(left, right) < 0;
}

/**
 * Returns true if the left time is greater than the right time, otherwise false
 * @param left Left side of the comparison
 * @param right Right side of the comparison
 * @returns Comparison result
 */
export function isGreaterThan(left: Time, right: Time): boolean {
  return compare(left, right) > 0;
}

/**
 * Returns true if both times have the same number of seconds and nanoseconds
 * @param left Left side of the comparison
 * @param right Right side of the comparison
 * @returns Equality result
 */
export function areEqual(left: Time, right: Time): boolean {
  return left.sec === right.sec && left.nsec === right.nsec;
}
