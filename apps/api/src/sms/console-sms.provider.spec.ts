import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { ConsoleSmsProvider } from './console-sms.provider';

function configReturning(nodeEnv: string): ConfigService<ApiEnv, true> {
  return { get: () => nodeEnv } as unknown as ConfigService<ApiEnv, true>;
}

describe('ConsoleSmsProvider', () => {
  const otpBody = 'Your verification code is 123456. It expires in 10 minutes.';

  it('logs the OTP in development (the only place a dev can see the code)', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const provider = new ConsoleSmsProvider(configReturning('development'));

    await provider.send('+14155551234', otpBody);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('123456'));
    logSpy.mockRestore();
  });

  it('never logs the OTP in production', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const provider = new ConsoleSmsProvider(configReturning('production'));

    await provider.send('+14155551234', otpBody);

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const warnCalls = warnSpy.mock.calls.flat().join(' ');
    expect(warnCalls).not.toContain('123456');

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
