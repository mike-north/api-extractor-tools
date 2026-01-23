export interface ExtractorExample {
  name: string
  description: string
  /** TypeScript source code (will generate .d.ts) */
  source: string
}

export const extractorExamples: ExtractorExample[] = [
  {
    name: 'Simple Function',
    description: 'A basic function with JSDoc documentation',
    source: `/**
 * Greets a person by name.
 * @param name - The name of the person to greet
 * @returns A greeting message
 * @public
 */
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

/**
 * The current version of the library.
 * @public
 */
export const VERSION = '1.0.0';
`,
  },
  {
    name: 'Interface & Type Exports',
    description: 'Demonstrates interface and type alias extraction',
    source: `/**
 * Configuration options for the application.
 * @public
 */
export interface AppConfig {
  /** Enable debug mode */
  debug: boolean;
  /** API endpoint URL */
  apiUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Supported log levels.
 * @public
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Creates a new configuration with defaults.
 * @param overrides - Partial configuration to override defaults
 * @returns Complete configuration object
 * @public
 */
export function createConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    debug: false,
    apiUrl: 'https://api.example.com',
    ...overrides,
  };
}
`,
  },
  {
    name: 'Class with Methods',
    description: 'A class with constructor, methods, and properties',
    source: `/**
 * A simple calculator class.
 * @public
 */
export class Calculator {
  private _value: number;

  /**
   * Creates a new Calculator instance.
   * @param initialValue - The starting value (defaults to 0)
   */
  constructor(initialValue: number = 0) {
    this._value = initialValue;
  }

  /**
   * Gets the current value.
   */
  get value(): number {
    return this._value;
  }

  /**
   * Adds a number to the current value.
   * @param n - The number to add
   * @returns The calculator instance for chaining
   */
  add(n: number): this {
    this._value += n;
    return this;
  }

  /**
   * Multiplies the current value by a number.
   * @param n - The multiplier
   * @returns The calculator instance for chaining
   */
  multiply(n: number): this {
    this._value *= n;
    return this;
  }

  /**
   * Resets the calculator to zero.
   */
  reset(): void {
    this._value = 0;
  }
}
`,
  },
  {
    name: 'Release Tags Demo',
    description: 'Shows @public, @beta, @alpha, and @internal tags',
    source: `/**
 * Stable public API function.
 * @public
 */
export function stableFunction(): string {
  return 'stable';
}

/**
 * Beta feature - may change in future versions.
 * @beta
 */
export function betaFeature(): string {
  return 'beta';
}

/**
 * Alpha feature - experimental and unstable.
 * @alpha
 */
export function alphaFeature(): string {
  return 'alpha';
}

/**
 * Internal implementation detail - not part of public API.
 * @internal
 */
export function _internalHelper(): void {
  // Implementation detail
}

/**
 * Public interface with mixed visibility members.
 * @public
 */
export interface MixedVisibility {
  /** Public property */
  publicProp: string;

  /**
   * Beta property - may change
   * @beta
   */
  betaProp?: number;
}
`,
  },
  {
    name: 'Generic Types',
    description: 'Generic functions and interfaces',
    source: `/**
 * A generic result type for operations that may fail.
 * @typeParam T - The success value type
 * @typeParam E - The error type
 * @public
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * A generic repository interface.
 * @typeParam T - The entity type
 * @public
 */
export interface Repository<T> {
  /** Find an entity by ID */
  findById(id: string): Promise<T | null>;
  /** Find all entities */
  findAll(): Promise<T[]>;
  /** Save an entity */
  save(entity: T): Promise<T>;
  /** Delete an entity by ID */
  delete(id: string): Promise<boolean>;
}

/**
 * Wraps a promise in a Result type.
 * @typeParam T - The promise value type
 * @param promise - The promise to wrap
 * @returns A Result containing either the value or the error
 * @public
 */
export async function tryCatch<T>(
  promise: Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}
`,
  },
  {
    name: 'Namespace & Enums',
    description: 'Demonstrates namespace and enum extraction',
    source: `/**
 * HTTP status codes.
 * @public
 */
export enum HttpStatus {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
  InternalServerError = 500,
}

/**
 * Utilities for working with HTTP.
 * @public
 */
export namespace Http {
  /**
   * HTTP methods.
   */
  export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /**
   * HTTP request options.
   */
  export interface RequestOptions {
    method: Method;
    headers?: Record<string, string>;
    body?: unknown;
  }

  /**
   * Checks if a status code indicates success.
   * @param status - The HTTP status code
   */
  export function isSuccess(status: number): boolean {
    return status >= 200 && status < 300;
  }
}
`,
  },
]
