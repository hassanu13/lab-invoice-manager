/**
 * Direct-port helpers — confirm TS behaviour matches the Python source.
 * These are golden-data tests; if any fail we've drifted from the reference.
 */
import { describe, it, expect } from 'vitest';
import { cleanAmount, detectLab, detectFormat, toTitleCase } from '@/server/extraction/helpers';

describe('cleanAmount', () => {
  it.each([
    ['1,234.56', 1234.56],
    ['£1,234.56', 1234.56],
    ['$ 99.99', 99.99],
    ['  42 ', 42],
    ['0.00', null], // zero collapses to null, per Python
    ['', null],
    ['abc', null],
    [null, null],
    [undefined, null],
    [99.99, 99.99],
  ])('cleans %j -> %j', (input, expected) => {
    expect(cleanAmount(input)).toBe(expected);
  });
});

describe('detectLab', () => {
  it('matches a known lab name case-insensitively', () => {
    expect(detectLab('Statement from HALL DENTAL STUDIO')).toBe('Hall Dental Studio');
  });
  it('matches by INV-D prefix as Dent8', () => {
    expect(detectLab('Reference INV-D12345 / 2026')).toBe('Dent8');
  });
  it('matches by INV-IN prefix as Innovate Dental', () => {
    expect(detectLab('Reference INV-IN98765')).toBe('Innovate Dental');
  });
  it('returns null when no signal is present', () => {
    expect(detectLab('Some unrelated text')).toBeNull();
  });
});

describe('detectFormat', () => {
  it.each([
    ['Summary No: AB12 OrderID Patient Date Total', '3dental'],
    ['Statement from Hall Dental', 'hall'],
    ['Carl Kearney Statement', 'carlkearney'],
    ['Aesthetic World invoice', 'aestheticworld'],
    ['Digital Prosthetics monthly statement', 'digitalprothetics'],
    ['S4S advice statement', 's4s'],
    ['Invoice Amount £100 INV-D123 patient', 'dent8_innovate'],
    ['Some random text with no markers', 'standard'],
  ])('%j -> %s', (text, expected) => {
    expect(detectFormat(text)).toBe(expected);
  });
});

describe('toTitleCase', () => {
  it('basic words', () => {
    expect(toTitleCase('andy tarburton')).toBe('Andy Tarburton');
  });
  it('preserves apostrophe capitalisation', () => {
    expect(toTitleCase("o'brien")).toBe("O'Brien");
  });
  it('lowercases all-caps', () => {
    expect(toTitleCase('U BUKSH')).toBe('U Buksh');
  });
});
