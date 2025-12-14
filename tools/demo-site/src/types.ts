/**
 * Available policy names in the demo site.
 *
 * Note: The 'custom' option is reserved for a future UI that would allow
 * users to build custom policies using the rule builder API. The underlying
 * `createPolicy()` API fully supports custom policies.
 */
export type PolicyName = 'default' | 'read-only' | 'write-only' | 'custom'
