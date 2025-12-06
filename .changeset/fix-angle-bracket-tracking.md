---
'@api-extractor-tools/change-detector': patch
---

Fixed angle bracket tracking in optional parameter detection to properly handle generic types.

The `stripTopLevelParamOptionalMarkers` function now:

- Tracks angle brackets at all nesting depths (not just outside parentheses), correctly handling generic types in parameter lists like `Array<string>`
- Checks `angleDepth === 0` before identifying optional markers, preventing incorrect stripping of `?` operators from conditional types like `<T extends Foo ? Bar : Baz>`

This improves accuracy when detecting optional parameter changes in functions with complex generic type signatures.
