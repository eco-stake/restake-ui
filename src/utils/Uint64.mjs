import Long from 'long';
import { BinaryWriter } from 'cosmjs-types/binary.js';

const MAX_UINT64 = '18446744073709551615';

export function uint64(value, field = 'value') {
  if (Long.isLong(value) || typeof value === 'bigint') value = value.toString();
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Unsafe uint64 ${field}`);
    value = value.toString();
  }
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) ||
      value.length > MAX_UINT64.length || (value.length === MAX_UINT64.length && value > MAX_UINT64)) {
    throw new Error(`Invalid uint64 ${field}`);
  }
  return value;
}

export function returnedAccountNumber(value) {
  if (!Long.isLong(value)) return uint64(value, 'account number');
  // A provider may return the uint64 field as a signed Long. Compare its
  // exact bits, without accepting negative decimal input or editing sign bytes.
  if (!Number.isInteger(value.low) || value.low < -2147483648 || value.low > 2147483647 ||
      !Number.isInteger(value.high) || value.high < -2147483648 || value.high > 2147483647 ||
      typeof value.unsigned !== 'boolean') throw new Error('Invalid returned account number');
  return Long.fromBits(value.low, value.high, true).toString();
}

export class ExactBinaryWriter extends BinaryWriter {
  // cosmjs-types 0.9 truncates uint64 values 2^31..2^32-1 when the high
  // word is zero. uint32 emits the same unsigned protobuf varint for them.
  uint64 = value => {
    const integer = BigInt(uint64(value));
    return integer <= 0xffffffffn ? this.uint32(Number(integer)) : super.int64(integer);
  };
}
