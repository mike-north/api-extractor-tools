/**
 * Minimal TypeScript lib definitions for browser-based compilation.
 *
 * This provides just enough type definitions for the demo examples to compile
 * without needing to load the full TypeScript lib files (which are large and
 * require Node.js filesystem access).
 */

export const MINIMAL_LIB_CONTENT = `/// <reference no-default-lib="true"/>

// Primitive types
interface Boolean {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface IArguments {}
interface Number {}
interface Object {}
interface RegExp {}
interface String {}
interface Symbol {}

// Fundamental interfaces
interface Array<T> {
  readonly length: number;
  [n: number]: T;
  push(...items: T[]): number;
  pop(): T | undefined;
  shift(): T | undefined;
  unshift(...items: T[]): number;
  slice(start?: number, end?: number): T[];
  splice(start: number, deleteCount?: number, ...items: T[]): T[];
  indexOf(searchElement: T, fromIndex?: number): number;
  includes(searchElement: T, fromIndex?: number): boolean;
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[];
  filter(predicate: (value: T, index: number, array: T[]) => unknown): T[];
  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
  forEach(callbackfn: (value: T, index: number, array: T[]) => void): void;
  find(predicate: (value: T, index: number, obj: T[]) => unknown): T | undefined;
  some(predicate: (value: T, index: number, array: T[]) => unknown): boolean;
  every(predicate: (value: T, index: number, array: T[]) => unknown): boolean;
  join(separator?: string): string;
  concat(...items: (T | T[])[]): T[];
  sort(compareFn?: (a: T, b: T) => number): this;
  reverse(): T[];
}

interface ReadonlyArray<T> {
  readonly length: number;
  readonly [n: number]: T;
  includes(searchElement: T, fromIndex?: number): boolean;
  indexOf(searchElement: T, fromIndex?: number): number;
  slice(start?: number, end?: number): T[];
  map<U>(callbackfn: (value: T, index: number, array: readonly T[]) => U): U[];
  filter(predicate: (value: T, index: number, array: readonly T[]) => unknown): T[];
  forEach(callbackfn: (value: T, index: number, array: readonly T[]) => void): void;
  find(predicate: (value: T, index: number, obj: readonly T[]) => unknown): T | undefined;
  some(predicate: (value: T, index: number, array: readonly T[]) => unknown): boolean;
  every(predicate: (value: T, index: number, array: readonly T[]) => unknown): boolean;
  join(separator?: string): string;
  concat(...items: (T | readonly T[])[]): T[];
}

interface ArrayConstructor {
  new <T>(arrayLength?: number): T[];
  new <T>(...items: T[]): T[];
  <T>(arrayLength?: number): T[];
  <T>(...items: T[]): T[];
  isArray(arg: unknown): arg is unknown[];
  readonly prototype: unknown[];
}
declare var Array: ArrayConstructor;

interface Map<K, V> {
  readonly size: number;
  clear(): void;
  delete(key: K): boolean;
  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
  set(key: K, value: V): this;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[K, V]>;
  [Symbol.iterator](): IterableIterator<[K, V]>;
}

interface MapConstructor {
  new <K, V>(entries?: readonly (readonly [K, V])[] | null): Map<K, V>;
  readonly prototype: Map<unknown, unknown>;
}
declare var Map: MapConstructor;

interface Set<T> {
  readonly size: number;
  add(value: T): this;
  clear(): void;
  delete(value: T): boolean;
  forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void): void;
  has(value: T): boolean;
  keys(): IterableIterator<T>;
  values(): IterableIterator<T>;
  entries(): IterableIterator<[T, T]>;
  [Symbol.iterator](): IterableIterator<T>;
}

interface SetConstructor {
  new <T>(values?: readonly T[] | null): Set<T>;
  readonly prototype: Set<unknown>;
}
declare var Set: SetConstructor;

interface WeakMap<K extends object, V> {
  delete(key: K): boolean;
  get(key: K): V | undefined;
  has(key: K): boolean;
  set(key: K, value: V): this;
}

interface WeakSet<T extends object> {
  add(value: T): this;
  delete(value: T): boolean;
  has(value: T): boolean;
}

// Promise
interface PromiseLike<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}

interface Promise<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult>;
  finally(onfinally?: (() => void) | null): Promise<T>;
}

interface PromiseConstructor {
  new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void): Promise<T>;
  all<T extends readonly unknown[]>(values: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
  race<T extends readonly unknown[]>(values: T): Promise<Awaited<T[number]>>;
  reject<T = never>(reason?: unknown): Promise<T>;
  resolve(): Promise<void>;
  resolve<T>(value: T | PromiseLike<T>): Promise<T>;
}
declare var Promise: PromiseConstructor;

// Awaited utility type
type Awaited<T> = T extends null | undefined ? T :
  T extends object & { then(onfulfilled: infer F, ...args: infer _): unknown } ?
    F extends ((value: infer V, ...args: infer _) => unknown) ? Awaited<V> : never :
  T;

// Error types
interface Error {
  name: string;
  message: string;
  stack?: string;
}

interface ErrorConstructor {
  new (message?: string): Error;
  (message?: string): Error;
  readonly prototype: Error;
}
declare var Error: ErrorConstructor;

interface TypeError extends Error {}
interface RangeError extends Error {}
interface SyntaxError extends Error {}
interface ReferenceError extends Error {}
interface EvalError extends Error {}
interface URIError extends Error {}

// Date
interface Date {
  toString(): string;
  toDateString(): string;
  toTimeString(): string;
  toLocaleString(): string;
  toLocaleDateString(): string;
  toLocaleTimeString(): string;
  valueOf(): number;
  getTime(): number;
  getFullYear(): number;
  getMonth(): number;
  getDate(): number;
  getDay(): number;
  getHours(): number;
  getMinutes(): number;
  getSeconds(): number;
  getMilliseconds(): number;
  setTime(time: number): number;
  setFullYear(year: number, month?: number, date?: number): number;
  setMonth(month: number, date?: number): number;
  setDate(date: number): number;
  setHours(hours: number, min?: number, sec?: number, ms?: number): number;
  setMinutes(min: number, sec?: number, ms?: number): number;
  setSeconds(sec: number, ms?: number): number;
  setMilliseconds(ms: number): number;
  toISOString(): string;
  toJSON(): string;
}

interface DateConstructor {
  new (): Date;
  new (value: number | string): Date;
  new (year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number): Date;
  (): string;
  readonly prototype: Date;
  parse(s: string): number;
  now(): number;
}
declare var Date: DateConstructor;

// JSON
interface JSON {
  parse(text: string, reviver?: (key: string, value: unknown) => unknown): unknown;
  stringify(value: unknown, replacer?: (key: string, value: unknown) => unknown, space?: string | number): string;
  stringify(value: unknown, replacer?: (number | string)[] | null, space?: string | number): string;
}
declare var JSON: JSON;

// Console
interface Console {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  info(...data: unknown[]): void;
  debug(...data: unknown[]): void;
  dir(item?: unknown, options?: object): void;
  table(tabularData?: unknown, properties?: string[]): void;
  time(label?: string): void;
  timeEnd(label?: string): void;
  trace(...data: unknown[]): void;
  assert(condition?: boolean, ...data: unknown[]): void;
  clear(): void;
  count(label?: string): void;
  countReset(label?: string): void;
  group(...data: unknown[]): void;
  groupCollapsed(...data: unknown[]): void;
  groupEnd(): void;
}
declare var console: Console;

// Math
interface Math {
  readonly E: number;
  readonly LN10: number;
  readonly LN2: number;
  readonly LOG2E: number;
  readonly LOG10E: number;
  readonly PI: number;
  readonly SQRT1_2: number;
  readonly SQRT2: number;
  abs(x: number): number;
  acos(x: number): number;
  asin(x: number): number;
  atan(x: number): number;
  atan2(y: number, x: number): number;
  ceil(x: number): number;
  cos(x: number): number;
  exp(x: number): number;
  floor(x: number): number;
  log(x: number): number;
  max(...values: number[]): number;
  min(...values: number[]): number;
  pow(x: number, y: number): number;
  random(): number;
  round(x: number): number;
  sin(x: number): number;
  sqrt(x: number): number;
  tan(x: number): number;
  trunc(x: number): number;
  sign(x: number): number;
}
declare var Math: Math;

// Symbol
interface SymbolConstructor {
  readonly prototype: Symbol;
  readonly iterator: unique symbol;
  readonly asyncIterator: unique symbol;
  readonly toStringTag: unique symbol;
  for(key: string): symbol;
  keyFor(sym: symbol): string | undefined;
}
declare var Symbol: SymbolConstructor;

// Iterators
interface IteratorYieldResult<TYield> {
  done?: false;
  value: TYield;
}

interface IteratorReturnResult<TReturn> {
  done: true;
  value: TReturn;
}

type IteratorResult<T, TReturn = unknown> = IteratorYieldResult<T> | IteratorReturnResult<TReturn>;

interface Iterator<T, TReturn = unknown, TNext = undefined> {
  next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
  return?(value?: TReturn): IteratorResult<T, TReturn>;
  throw?(e?: unknown): IteratorResult<T, TReturn>;
}

interface Iterable<T> {
  [Symbol.iterator](): Iterator<T>;
}

interface IterableIterator<T> extends Iterator<T> {
  [Symbol.iterator](): IterableIterator<T>;
}

interface AsyncIterator<T, TReturn = unknown, TNext = undefined> {
  next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
  return?(value?: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>>;
  throw?(e?: unknown): Promise<IteratorResult<T, TReturn>>;
}

interface AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

interface AsyncIterableIterator<T> extends AsyncIterator<T> {
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

// Generator
interface Generator<T = unknown, TReturn = unknown, TNext = unknown> extends Iterator<T, TReturn, TNext> {
  next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
  return(value: TReturn): IteratorResult<T, TReturn>;
  throw(e: unknown): IteratorResult<T, TReturn>;
  [Symbol.iterator](): Generator<T, TReturn, TNext>;
}

interface AsyncGenerator<T = unknown, TReturn = unknown, TNext = unknown> extends AsyncIterator<T, TReturn, TNext> {
  next(...args: [] | [TNext]): Promise<IteratorResult<T, TReturn>>;
  return(value: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>>;
  throw(e: unknown): Promise<IteratorResult<T, TReturn>>;
  [Symbol.asyncIterator](): AsyncGenerator<T, TReturn, TNext>;
}

// Utility types
type Partial<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Omit<T, K extends keyof unknown> = Pick<T, Exclude<keyof T, K>>;
type Record<K extends keyof unknown, T> = { [P in K]: T };
type Exclude<T, U> = T extends U ? never : T;
type Extract<T, U> = T extends U ? T : never;
type NonNullable<T> = T extends null | undefined ? never : T;
type Parameters<T extends (...args: unknown[]) => unknown> = T extends (...args: infer P) => unknown ? P : never;
type ConstructorParameters<T extends abstract new (...args: unknown[]) => unknown> = T extends abstract new (...args: infer P) => unknown ? P : never;
type ReturnType<T extends (...args: unknown[]) => unknown> = T extends (...args: unknown[]) => infer R ? R : unknown;
type InstanceType<T extends abstract new (...args: unknown[]) => unknown> = T extends abstract new (...args: unknown[]) => infer R ? R : unknown;

// ThisType
interface ThisType<T> {}

// Template literal types
type Uppercase<S extends string> = intrinsic;
type Lowercase<S extends string> = intrinsic;
type Capitalize<S extends string> = intrinsic;
type Uncapitalize<S extends string> = intrinsic;

// PropertyKey
type PropertyKey = string | number | symbol;

// Object methods
interface ObjectConstructor {
  new (value?: unknown): Object;
  (): unknown;
  (value: unknown): unknown;
  readonly prototype: Object;
  keys(o: object): string[];
  values<T>(o: { [s: string]: T } | ArrayLike<T>): T[];
  entries<T>(o: { [s: string]: T } | ArrayLike<T>): [string, T][];
  assign<T extends {}, U>(target: T, source: U): T & U;
  assign<T extends {}, U, V>(target: T, source1: U, source2: V): T & U & V;
  assign(target: object, ...sources: unknown[]): unknown;
  getOwnPropertyNames(o: unknown): string[];
  getOwnPropertySymbols(o: unknown): symbol[];
  getPrototypeOf(o: unknown): unknown;
  setPrototypeOf(o: unknown, proto: object | null): unknown;
  defineProperty<T>(o: T, p: PropertyKey, attributes: PropertyDescriptor & ThisType<unknown>): T;
  freeze<T>(o: T): Readonly<T>;
  seal<T>(o: T): T;
  isFrozen(o: unknown): boolean;
  isSealed(o: unknown): boolean;
  isExtensible(o: unknown): boolean;
  preventExtensions<T>(o: T): T;
  create(o: object | null, properties?: PropertyDescriptorMap & ThisType<unknown>): unknown;
  fromEntries<T = unknown>(entries: Iterable<readonly [PropertyKey, T]>): { [k: string]: T };
  hasOwn(o: object, p: PropertyKey): boolean;
}
declare var Object: ObjectConstructor;

interface PropertyDescriptor {
  configurable?: boolean;
  enumerable?: boolean;
  value?: unknown;
  writable?: boolean;
  get?(): unknown;
  set?(v: unknown): void;
}

interface PropertyDescriptorMap {
  [key: PropertyKey]: PropertyDescriptor;
}

// String methods
interface StringConstructor {
  new (value?: unknown): String;
  (value?: unknown): string;
  readonly prototype: String;
  fromCharCode(...codes: number[]): string;
  fromCodePoint(...codePoints: number[]): string;
}
declare var String: StringConstructor;

// Number
interface NumberConstructor {
  new (value?: unknown): Number;
  (value?: unknown): number;
  readonly prototype: Number;
  readonly MAX_VALUE: number;
  readonly MIN_VALUE: number;
  readonly NaN: number;
  readonly NEGATIVE_INFINITY: number;
  readonly POSITIVE_INFINITY: number;
  readonly MAX_SAFE_INTEGER: number;
  readonly MIN_SAFE_INTEGER: number;
  readonly EPSILON: number;
  isFinite(number: unknown): boolean;
  isInteger(number: unknown): boolean;
  isNaN(number: unknown): boolean;
  isSafeInteger(number: unknown): boolean;
  parseFloat(string: string): number;
  parseInt(string: string, radix?: number): number;
}
declare var Number: NumberConstructor;

// Global functions
declare function parseInt(string: string, radix?: number): number;
declare function parseFloat(string: string): number;
declare function isNaN(number: number): boolean;
declare function isFinite(number: number): boolean;
declare function encodeURI(uri: string): string;
declare function encodeURIComponent(uriComponent: string | number | boolean): string;
declare function decodeURI(encodedURI: string): string;
declare function decodeURIComponent(encodedURIComponent: string): string;

// Typed Arrays
interface ArrayBuffer {
  readonly byteLength: number;
  slice(begin: number, end?: number): ArrayBuffer;
}

interface ArrayBufferConstructor {
  readonly prototype: ArrayBuffer;
  new (byteLength: number): ArrayBuffer;
  isView(arg: unknown): arg is ArrayBufferView;
}
declare var ArrayBuffer: ArrayBufferConstructor;

interface ArrayBufferView {
  buffer: ArrayBuffer;
  byteLength: number;
  byteOffset: number;
}

interface DataView {
  readonly buffer: ArrayBuffer;
  readonly byteLength: number;
  readonly byteOffset: number;
  getFloat32(byteOffset: number, littleEndian?: boolean): number;
  getFloat64(byteOffset: number, littleEndian?: boolean): number;
  getInt8(byteOffset: number): number;
  getInt16(byteOffset: number, littleEndian?: boolean): number;
  getInt32(byteOffset: number, littleEndian?: boolean): number;
  getUint8(byteOffset: number): number;
  getUint16(byteOffset: number, littleEndian?: boolean): number;
  getUint32(byteOffset: number, littleEndian?: boolean): number;
  setFloat32(byteOffset: number, value: number, littleEndian?: boolean): void;
  setFloat64(byteOffset: number, value: number, littleEndian?: boolean): void;
  setInt8(byteOffset: number, value: number): void;
  setInt16(byteOffset: number, value: number, littleEndian?: boolean): void;
  setInt32(byteOffset: number, value: number, littleEndian?: boolean): void;
  setUint8(byteOffset: number, value: number): void;
  setUint16(byteOffset: number, value: number, littleEndian?: boolean): void;
  setUint32(byteOffset: number, value: number, littleEndian?: boolean): void;
}

interface DataViewConstructor {
  readonly prototype: DataView;
  new (buffer: ArrayBuffer, byteOffset?: number, byteLength?: number): DataView;
}
declare var DataView: DataViewConstructor;

// TypedArray base interface
interface TypedArray {
  readonly BYTES_PER_ELEMENT: number;
  readonly buffer: ArrayBuffer;
  readonly byteLength: number;
  readonly byteOffset: number;
  readonly length: number;
}

interface Int8Array extends TypedArray {
  [index: number]: number;
}
interface Uint8Array extends TypedArray {
  [index: number]: number;
}
interface Uint8ClampedArray extends TypedArray {
  [index: number]: number;
}
interface Int16Array extends TypedArray {
  [index: number]: number;
}
interface Uint16Array extends TypedArray {
  [index: number]: number;
}
interface Int32Array extends TypedArray {
  [index: number]: number;
}
interface Uint32Array extends TypedArray {
  [index: number]: number;
}
interface Float32Array extends TypedArray {
  [index: number]: number;
}
interface Float64Array extends TypedArray {
  [index: number]: number;
}
interface BigInt64Array extends TypedArray {
  [index: number]: bigint;
}
interface BigUint64Array extends TypedArray {
  [index: number]: bigint;
}

// BigInt
interface BigInt {
  toString(radix?: number): string;
  toLocaleString(): string;
  valueOf(): bigint;
}

interface BigIntConstructor {
  (value: bigint | boolean | number | string): bigint;
  readonly prototype: BigInt;
  asIntN(bits: number, int: bigint): bigint;
  asUintN(bits: number, int: bigint): bigint;
}
declare var BigInt: BigIntConstructor;
`
