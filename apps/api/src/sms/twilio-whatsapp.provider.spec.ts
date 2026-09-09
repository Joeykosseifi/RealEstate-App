import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';

const mockCreate = jest.fn();
const mockTwilioFactory = jest.fn(() => ({ messages: { create: mockCreate } }));
jest.mock('twilio', () => mockTwilioFactory);

// Imported after the mock so TwilioWhatsAppProvider's own `import twilio from 'twilio'` resolves to the mock above.
// eslint-disable-next-line import/first
import { TwilioWhatsAppProvider } from './twilio-whatsapp.provider';

function configFrom(values: Record<string, unknown>): ConfigService<ApiEnv, true> {
  return { get: (key: string) => values[key] } as unknown as ConfigService<ApiEnv, true>;
}

const validConfig = {
  TWILIO_ACCOUNT_SID: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  TWILIO_AUTH_TOKEN: 'secret-auth-token',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
};

describe('TwilioWhatsAppProvider', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockTwilioFactory.mockClear();
  });

  it('throws at construction when TWILIO_* config is missing — fails loudly at boot rather than silently dropping messages', () => {
    expect(() => new TwilioWhatsAppProvider(configFrom({}))).toThrow(/TWILIO_ACCOUNT_SID/);
  });

  it('sends a WhatsApp message with the whatsapp: prefix on the recipient', async () => {
    mockCreate.mockResolvedValue(undefined);
    const provider = new TwilioWhatsAppProvider(configFrom(validConfig));

    await provider.send('+15551234567', 'Your verification code is 123456');

    expect(mockTwilioFactory).toHaveBeenCalledWith(
      validConfig.TWILIO_ACCOUNT_SID,
      validConfig.TWILIO_AUTH_TOKEN,
    );
    expect(mockCreate).toHaveBeenCalledWith({
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+15551234567',
      body: 'Your verification code is 123456',
    });
  });

  it('adds the whatsapp: prefix to TWILIO_WHATSAPP_FROM if it was configured without one', async () => {
    mockCreate.mockResolvedValue(undefined);
    const provider = new TwilioWhatsAppProvider(
      configFrom({ ...validConfig, TWILIO_WHATSAPP_FROM: '+14155238886' }),
    );

    await provider.send('+15551234567', 'code');

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ from: 'whatsapp:+14155238886' }));
  });

  it('never throws into the caller when delivery fails — logs instead (registration/resend must not fail on a transient Twilio error)', async () => {
    mockCreate.mockRejectedValue(new Error('twilio unavailable'));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const provider = new TwilioWhatsAppProvider(configFrom(validConfig));

    await expect(provider.send('+15551234567', 'code')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
