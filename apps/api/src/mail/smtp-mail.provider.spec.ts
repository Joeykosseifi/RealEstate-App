import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.mock('nodemailer', () => ({ createTransport: mockCreateTransport }));

// Imported after the mock so SmtpMailProvider's own `import { createTransport } from 'nodemailer'` resolves to the mock above.
// eslint-disable-next-line import/first
import { SmtpMailProvider } from './smtp-mail.provider';

function configFrom(values: Record<string, unknown>): ConfigService<ApiEnv, true> {
  return { get: (key: string) => values[key] } as unknown as ConfigService<ApiEnv, true>;
}

const validConfig = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_USER: 'apikey',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'noreply@example.com',
};

describe('SmtpMailProvider', () => {
  beforeEach(() => {
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
  });

  it('throws at construction when SMTP_HOST/SMTP_USER/SMTP_PASSWORD are missing — fails loudly at boot rather than silently dropping mail', () => {
    expect(() => new SmtpMailProvider(configFrom({}))).toThrow(/SMTP_HOST/);
  });

  it('sends real mail through nodemailer using the configured From address', async () => {
    mockSendMail.mockResolvedValue(undefined);
    const provider = new SmtpMailProvider(configFrom(validConfig));

    await provider.send({ to: 'user@example.com', subject: 'Verify', text: 'code: 123456' });

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com', port: 587, secure: false }),
    );
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'user@example.com',
      subject: 'Verify',
      text: 'code: 123456',
    });
  });

  it('falls back to SMTP_USER as the From address when SMTP_FROM is unset', async () => {
    mockSendMail.mockResolvedValue(undefined);
    const provider = new SmtpMailProvider(configFrom({ ...validConfig, SMTP_FROM: undefined }));

    await provider.send({ to: 'user@example.com', subject: 'Verify', text: 'x' });

    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'apikey' }));
  });

  it('never throws into the caller when delivery fails — logs instead (registration/resend must not fail on a transient SMTP error)', async () => {
    mockSendMail.mockRejectedValue(new Error('connection refused'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const provider = new SmtpMailProvider(configFrom(validConfig));

    await expect(
      provider.send({ to: 'user@example.com', subject: 'Verify', text: 'x' }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
