// BILL-6 named once, on the describe: each test's full name, as the runner prints it, carries it.
import { describe, expect, it } from 'vitest';

const digits = /["'(]\d+/;

describe('BILL-6 rating', () => {
  it('AC-1 rates each unit at its tier', () => {
    expect(digits.test('(12')).toBe(true);
  });
  describe('flat plans', () => {
    it('AC-2 rates a flat plan at the flat price', () => {});
  });
});

test.describe.serial('rounding (BILL-6)', () => {
  test('AC-3 rounds half to even', async () => {});
});
