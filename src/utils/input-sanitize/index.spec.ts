import { describe, expect, it } from 'vitest';
import {
  sanitizeEmailInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  sanitizePositiveIntegerInput,
} from '.';

describe('input sanitizers', () => {
  it('normalizes email casing and whitespace', () => {
    expect(sanitizeEmailInput(' Host @Example.COM ')).toBe('host@example.com');
  });

  it('keeps readable Hebrew and Latin names while removing unsupported characters', () => {
    expect(sanitizeNameInput('מני Levi 123!')).toBe('מני Levi ');
  });

  it('keeps phone formatting characters and removes letters', () => {
    expect(sanitizePhoneInput('+972 (50) 123-4567 ext')).toBe('+972 (50) 123-4567 ');
  });

  it('keeps only digits for positive integer fields', () => {
    expect(sanitizePositiveIntegerInput('12 guests')).toBe('12');
  });
});
