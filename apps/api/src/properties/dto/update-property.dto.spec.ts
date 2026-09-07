import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePropertyDto } from './update-property.dto';

/**
 * Regression coverage for the omitted-vs-cleared distinction on
 * `bedrooms`/`bathrooms`/`areaSqm`: omitting the key must leave
 * `dto.<field>` as `undefined` (Prisma then leaves the stored value
 * untouched), while sending an explicit `null` must survive
 * class-transformer/class-validator as `null` — not get coerced into
 * `0` or `NaN` by `@Type(() => Number)`, and not get rejected by
 * `@IsOptional()`'s otherwise-active `@IsInt()`/`@Min()` checks. A
 * regular numeric value must still be validated normally.
 */
describe('UpdatePropertyDto — bedrooms/bathrooms/areaSqm clearing contract', () => {
  async function parse(input: Record<string, unknown>) {
    const instance = plainToInstance(UpdatePropertyDto, input);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    return { instance, errors };
  }

  it('omitting the field leaves it undefined and passes validation', async () => {
    const { instance, errors } = await parse({});
    expect(errors).toHaveLength(0);
    expect(instance.bedrooms).toBeUndefined();
    expect(instance.bathrooms).toBeUndefined();
    expect(instance.areaSqm).toBeUndefined();
  });

  it('an explicit null survives as null (not coerced to 0 or NaN) and passes validation', async () => {
    const { instance, errors } = await parse({
      bedrooms: null,
      bathrooms: null,
      areaSqm: null,
    });
    expect(errors).toHaveLength(0);
    expect(instance.bedrooms).toBeNull();
    expect(instance.bathrooms).toBeNull();
    expect(instance.areaSqm).toBeNull();
  });

  it('a real value is still validated normally', async () => {
    const valid = await parse({ bedrooms: 3, bathrooms: 2, areaSqm: 120.5 });
    expect(valid.errors).toHaveLength(0);
    expect(valid.instance.bedrooms).toBe(3);
    expect(valid.instance.bathrooms).toBe(2);
    expect(valid.instance.areaSqm).toBe(120.5);

    const invalid = await parse({ bedrooms: -1, bathrooms: -1, areaSqm: 0 });
    expect(invalid.errors.length).toBeGreaterThan(0);
    const invalidProperties = invalid.errors.map((error) => error.property);
    expect(invalidProperties).toEqual(
      expect.arrayContaining(['bedrooms', 'bathrooms', 'areaSqm']),
    );
  });
});
