import test from "node:test";
import assert from "node:assert/strict";

import { itemCategory } from "./bidOpportunityCategory.js";

test("rejects a stored bunch when any category is outside the allowlist", () => {
  assert.equal(itemCategory({
    product_type: "bunch_bid",
    product_name: "All in One PC (V2), A4 and Legal Size Multifunction Printer (MFP), Line Interactive UPS with AVR (V2)",
  }), "other");
});

test("does not treat a legacy false bunch flag on a single printer as Bunch Bid", () => {
  assert.equal(itemCategory({
    product_type: "bunch_bid",
    product_name: "A4 and Legal Size Multifunction Printer (MFP)",
  }), "printer");
});

test("keeps ordinary desktop categories unchanged", () => {
  assert.equal(itemCategory({ product_name: "High End Desktop Computer" }), "high_end_desktop");
  assert.equal(itemCategory({ product_name: "Entry and Mid Level Desktop Computer" }), "entry_mid_desktop");
  assert.equal(itemCategory({ product_name: "Desktop Computer" }), "other");
});

test("accepts an all-approved bunch and rejects A3 or PAC Only", () => {
  assert.equal(itemCategory({
    product_name: "All in One PC (V2), Entry and Mid Level Desktop Computer, A4 and Legal Size Multifunction Printer (MFP)",
  }), "bunch_bid");
  assert.equal(itemCategory({
    product_name: "A3 Size Multifunction Printer (MFP), A4 and Legal Size Multifunction Printer (MFP)",
  }), "other");
  assert.equal(itemCategory({
    product_name: "A4 and Legal Size Multifunction Printer (MFP) (Q2) (PAC Only)",
  }), "other");
});

