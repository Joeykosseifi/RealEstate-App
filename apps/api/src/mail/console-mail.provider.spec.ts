import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { ConsoleMailProvider } from './console-mail.provider';

function configReturning(nodeEnv: string): ConfigService<ApiEnv, true> {
  return { get: () => nodeEnv } as unknown as ConfigService<ApiEnv, true>;
}

describe('ConsoleMailProvider', () => {
  const message = {
    to: 'user@example.com',
    subject: 'Verify',
    text: 'token is: SUPER-SECRET-TOKEN',
  };

  it('logs the message content in development (the only place a dev can see the token)', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const provider = new ConsoleMailProvider(configReturning('development'));

    await provider.send(message);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('SUPER-SECRET-TOKEN'),
    );
    logSpy.mockRestore();
  });

  it('never logs the message content in production', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const provider = new ConsoleMailProvider(configReturning('production'));

    await provider.send(message);

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const warnCalls = warnSpy.mock.calls.flat().join(' ');
    expect(warnCalls).not.toContain('SUPER-SECRET-TOKEN');

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
