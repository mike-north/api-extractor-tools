export interface Example {
  name: string
  description: string
  old: string
  new: string
}

export const examples: Example[] = [
  {
    name: 'Optional Parameter Added (Minor)',
    description: 'Adding an optional parameter is a non-breaking change',
    old: `/**
 * Greets a person by name.
 */
export declare function greet(name: string): string;

export declare const VERSION: string;`,
    new: `/**
 * Greets a person by name with an optional prefix.
 */
export declare function greet(name: string, prefix?: string): string;

export declare const VERSION: string;`,
  },
  {
    name: 'Required Parameter Added (Major)',
    description: 'Adding a required parameter is a breaking change',
    old: `/**
 * Greets a person by name.
 */
export declare function greet(name: string): string;`,
    new: `/**
 * Greets a person by name with a required greeting.
 */
export declare function greet(name: string, greeting: string): string;`,
  },
  {
    name: 'Export Removed (Major)',
    description: 'Removing an export is a breaking change',
    old: `export declare function greet(name: string): string;
export declare function farewell(name: string): string;
export declare const VERSION: string;`,
    new: `export declare function greet(name: string): string;
export declare const VERSION: string;`,
  },
  {
    name: 'New Export Added (Minor)',
    description: 'Adding a new export is a non-breaking change',
    old: `export declare function greet(name: string): string;`,
    new: `export declare function greet(name: string): string;
export declare function farewell(name: string): string;`,
  },
  {
    name: 'Interface Property Added (Major)',
    description: 'Adding a required property to an interface is breaking',
    old: `export interface User {
  id: string;
  name: string;
}`,
    new: `export interface User {
  id: string;
  name: string;
  email: string;
}`,
  },
  {
    name: 'Type Union Widened (Major)',
    description: 'Widening a type union changes the contract',
    old: `export type Status = 'active' | 'inactive';`,
    new: `export type Status = 'active' | 'inactive' | 'pending';`,
  },
  {
    name: 'Return Type Changed (Major)',
    description: 'Changing a return type is a breaking change',
    old: `export declare function fetchUser(id: string): Promise<User>;

export interface User {
  id: string;
  name: string;
}`,
    new: `export declare function fetchUser(id: string): Promise<User | null>;

export interface User {
  id: string;
  name: string;
}`,
  },
  {
    name: 'Class Method Added (Minor)',
    description: 'Adding a new method to a class is typically non-breaking',
    old: `export declare class Calculator {
  add(a: number, b: number): number;
}`,
    new: `export declare class Calculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
}`,
  },
  {
    name: 'No Changes',
    description: 'Identical APIs result in no version bump',
    old: `export declare function greet(name: string): string;
export declare const VERSION: string;
export interface Config {
  debug: boolean;
}`,
    new: `export declare function greet(name: string): string;
export declare const VERSION: string;
export interface Config {
  debug: boolean;
}`,
  },
  {
    name: 'Generic Type Constraint Changed (Major)',
    description: 'Changing a generic type constraint is breaking',
    old: `export declare function process<T extends object>(value: T): T;`,
    new: `export declare function process<T extends Record<string, unknown>>(value: T): T;`,
  },
]
