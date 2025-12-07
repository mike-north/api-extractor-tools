import type { Example } from '../components/ExamplePicker'

export const EXAMPLES: Example[] = [
  {
    name: 'Add optional parameter',
    description: 'Adding an optional parameter is a minor change',
    expectedRelease: 'minor',
    old: `export declare function greet(name: string): string;`,
    new: `export declare function greet(name: string, prefix?: string): string;`,
  },
  {
    name: 'Add required parameter',
    description: 'Adding a required parameter is a breaking change',
    expectedRelease: 'major',
    old: `export declare function greet(name: string): string;`,
    new: `export declare function greet(name: string, prefix: string): string;`,
  },
  {
    name: 'Remove parameter',
    description: 'Removing a parameter is a breaking change',
    expectedRelease: 'major',
    old: `export declare function greet(name: string, prefix: string): string;`,
    new: `export declare function greet(name: string): string;`,
  },
  {
    name: 'Add new export',
    description: 'Adding a new export is a minor change',
    expectedRelease: 'minor',
    old: `export declare function greet(name: string): string;`,
    new: `export declare function greet(name: string): string;
export declare function farewell(name: string): string;`,
  },
  {
    name: 'Remove export',
    description: 'Removing an export is a breaking change',
    expectedRelease: 'major',
    old: `export declare function greet(name: string): string;
export declare function farewell(name: string): string;`,
    new: `export declare function greet(name: string): string;`,
  },
  {
    name: 'Change return type',
    description: 'Changing a return type is a breaking change',
    expectedRelease: 'major',
    old: `export declare function getData(): string;`,
    new: `export declare function getData(): number;`,
  },
  {
    name: 'Narrow parameter type',
    description:
      'Making a parameter type more restrictive is a breaking change',
    expectedRelease: 'major',
    old: `export declare function process(input: string | number): void;`,
    new: `export declare function process(input: string): void;`,
  },
  {
    name: 'Add interface property',
    description:
      'Adding a required property to an interface is a breaking change',
    expectedRelease: 'major',
    old: `export interface Config {
  name: string;
}`,
    new: `export interface Config {
  name: string;
  version: number;
}`,
  },
  {
    name: 'Add optional interface property',
    description:
      'Adding an optional property to an interface is typically safe',
    expectedRelease: 'major',
    old: `export interface Config {
  name: string;
}`,
    new: `export interface Config {
  name: string;
  description?: string;
}`,
  },
  {
    name: 'Remove interface property',
    description: 'Removing a property from an interface is a breaking change',
    expectedRelease: 'major',
    old: `export interface Config {
  name: string;
  version: number;
}`,
    new: `export interface Config {
  name: string;
}`,
  },
  {
    name: 'Change class constructor',
    description: 'Adding a required constructor parameter is a breaking change',
    expectedRelease: 'major',
    old: `export declare class User {
  constructor(name: string);
  readonly name: string;
}`,
    new: `export declare class User {
  constructor(name: string, email: string);
  readonly name: string;
  readonly email: string;
}`,
  },
  {
    name: 'Add class method',
    description: 'Adding a new method to a class is a minor change',
    expectedRelease: 'minor',
    old: `export declare class Calculator {
  add(a: number, b: number): number;
}`,
    new: `export declare class Calculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
}`,
  },
  {
    name: 'Type alias narrowing',
    description: 'Narrowing a type alias is a breaking change',
    expectedRelease: 'major',
    old: `export type Status = 'pending' | 'active' | 'completed' | 'cancelled';`,
    new: `export type Status = 'pending' | 'active' | 'completed';`,
  },
  {
    name: 'Type alias widening',
    description: 'Widening a type alias adds options (minor impact varies)',
    expectedRelease: 'major',
    old: `export type Status = 'pending' | 'active' | 'completed';`,
    new: `export type Status = 'pending' | 'active' | 'completed' | 'cancelled';`,
  },
  {
    name: 'No changes',
    description: 'Identical declarations result in no version bump',
    expectedRelease: 'none',
    old: `export declare function greet(name: string): string;
export declare const VERSION: string;`,
    new: `export declare function greet(name: string): string;
export declare const VERSION: string;`,
  },
]
