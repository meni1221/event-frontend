import { describe, expect, it } from 'vitest';
import { getPasswordStrength } from '.';

describe('getPasswordStrength', () => {
  it('reports every missing rule for an empty password', () => {
    const strength = getPasswordStrength('');

    expect(strength.isStrong).toBe(false);
    expect(strength.score).toBe(0);
    expect(strength.missingKeys).toEqual([
      'passwordRuleLength',
      'passwordRuleLowercase',
      'passwordRuleUppercase',
      'passwordRuleNumber',
      'passwordRuleSpecial',
    ]);
  });

  it('requires all password rules before reporting a strong password', () => {
    const strength = getPasswordStrength('SecurePass1!');

    expect(strength).toMatchObject({
      isStrong: true,
      labelKey: 'passwordStrong',
      missingKeys: [],
      score: 5,
      value: 100,
    });
  });
});
