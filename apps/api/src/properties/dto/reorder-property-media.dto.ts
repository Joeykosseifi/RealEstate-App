import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** `mediaIds` must list every media row currently on the property, exactly once, in the new order. */
export class ReorderPropertyMediaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mediaIds!: string[];
}
