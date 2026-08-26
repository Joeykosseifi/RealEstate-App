import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  const service = new UsersService({} as PrismaService);

  describe('normalizeEmail', () => {
    it('lowercases and trims', () => {
      expect(service.normalizeEmail('  Foo.Bar@Example.COM  ')).toBe(
        'foo.bar@example.com',
      );
    });
  });

  describe('normalizePhone', () => {
    it('formats a valid international number to E.164', () => {
      expect(service.normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
    });

    it('rejects an unparsable/invalid number', () => {
      expect(() => service.normalizePhone('not-a-phone')).toThrow(
        BadRequestException,
      );
      expect(() => service.normalizePhone('+15551234567')).toThrow(
        BadRequestException,
      );
    });
  });
});
