import { describe, expect, it } from 'vitest';
import { validateEmail, validatePhone, validatePositiveNumber } from '.';

describe('validation', () => {
  it('accepts a trimmed email and rejects malformed addresses', () => {
    expect(validateEmail('  host@example.com  ', 'invalid')).toEqual({ isValid: true, message: null });
    expect(validateEmail('host@example', 'invalid')).toEqual({ isValid: false, message: 'invalid' });
  });

  it('accepts common Israeli phone formats', () => {
    expect(validatePhone('050-123-4567', 'invalid').isValid).toBe(true);
    expect(validatePhone('+972 50 123 4567', 'invalid').isValid).toBe(true);
    expect(validatePhone('12345', 'invalid')).toEqual({ isValid: false, message: 'invalid' });
  });

  it('requires a whole number greater than zero', () => {
    expect(validatePositiveNumber('12', 'invalid').isValid).toBe(true);
    expect(validatePositiveNumber('0', 'invalid').isValid).toBe(false);
    expect(validatePositiveNumber('2.5', 'invalid').isValid).toBe(false);
  });
});
