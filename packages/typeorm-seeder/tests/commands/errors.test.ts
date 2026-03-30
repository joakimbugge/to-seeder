import { describe, expect, it, vi } from 'vitest';
import { isTypeScriptImportError, printTypeScriptError } from '../../src/commands/errors.js';

describe('isTypeScriptImportError()', () => {
  it('returns true for ERR_UNKNOWN_FILE_EXTENSION errors', () => {
    const err = Object.assign(new Error('unknown file ext'), {
      code: 'ERR_UNKNOWN_FILE_EXTENSION',
    });

    expect(isTypeScriptImportError(err)).toBe(true);
  });

  it('returns false for a plain Error without a code', () => {
    expect(isTypeScriptImportError(new Error('oops'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isTypeScriptImportError(null)).toBe(false);
    expect(isTypeScriptImportError('string error')).toBe(false);
    expect(isTypeScriptImportError(42)).toBe(false);
  });
});

describe('printTypeScriptError()', () => {
  it('logs a message containing the command name to console.error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    printTypeScriptError('seed:run');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('seed:run'));

    errorSpy.mockRestore();
  });
});
