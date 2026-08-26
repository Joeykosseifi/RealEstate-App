import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { PrismaService } from '../prisma/prisma.service';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lowercase + trim — the single normalization rule applied before every email comparison or write. */
  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Parses and formats a phone number to E.164 (e.g. +15551234567).
   * Requires an internationally-formatted number (leading "+"); we don't
   * guess a default region, since a wrong guess would silently store the
   * wrong number. Throws BadRequestException on anything unparsable.
   */
  normalizePhone(phone: string): string {
    const parsed = parsePhoneNumberFromString(phone);
    if (!parsed || !parsed.isValid()) {
      throw new BadRequestException(
        'Invalid phone number. Use international format, e.g. +15551234567.',
      );
    }
    return parsed.number;
  }

  async findByEmail(
    email: string,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<User | null> {
    return client.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async findById(
    id: string,
    client: PrismaClientOrTx = this.prisma,
  ): Promise<User | null> {
    return client.user.findUnique({ where: { id } });
  }
}
