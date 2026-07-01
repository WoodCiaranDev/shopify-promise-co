// @ts-check

/**
 * Co-Lab cart bundle merger.
 *
 * Lines added by the Co-Lab picker share a `_bundle_id` line item property.
 * One line per bundle has `_bundle_role: parent` (the ring); others are
 * `_bundle_role: birthstone | engraving` add-on lines.
 *
 * This function merges all lines sharing a bundle id into a single
 * presentation line (the parent variant) so the cart, checkout, and order
 * confirmation all show "Promise Heart Solitaire — 18k Gold, L — Birthstone
 * One: Sapphire — Engraving: Forever" as one row. The bundled price is the
 * natural sum of the constituent line prices (no discount, no markup) so the
 * customer pays exactly base + add-ons.
 *
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

const NO_CHANGES = { operations: [] };

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const bundles = new Map();

  for (const line of input.cart.lines) {
    const bid = line.bundleId?.value;
    if (!bid) continue;
    if (!bundles.has(bid)) bundles.set(bid, []);
    bundles.get(bid).push(line);
  }

  const operations = [];

  for (const lines of bundles.values()) {
    if (lines.length < 2) continue; // nothing to merge — orphan parent

    const parent = lines.find((l) => l.bundleRole?.value === "parent");
    if (!parent) continue; // bundle has add-ons but no parent — skip
    if (!parent.merchandise?.id) continue;

    const attributes = [];
    if (parent.birthstoneOne?.value)
      attributes.push({ key: "Birthstone One", value: parent.birthstoneOne.value });
    if (parent.birthstoneTwo?.value)
      attributes.push({ key: "Birthstone Two", value: parent.birthstoneTwo.value });
    if (parent.engraving?.value)
      attributes.push({ key: "Engraving", value: parent.engraving.value });

    operations.push({
      merge: {
        cartLines: lines.map((l) => ({
          cartLineId: l.id,
          quantity: l.quantity,
        })),
        parentVariantId: parent.merchandise.id,
        attributes,
      },
    });
  }

  return operations.length ? { operations } : NO_CHANGES;
}
