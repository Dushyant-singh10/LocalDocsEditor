import { describe, expect, it } from "vitest";
import { roleAtLeast } from "./types.js";

describe("roleAtLeast", () => {
  it("owner satisfies every minimum", () => {
    expect(roleAtLeast("owner", "owner")).toBe(true);
    expect(roleAtLeast("owner", "editor")).toBe(true);
    expect(roleAtLeast("owner", "viewer")).toBe(true);
  });

  it("viewer only satisfies viewer", () => {
    expect(roleAtLeast("viewer", "viewer")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast("viewer", "owner")).toBe(false);
  });

  it("editor satisfies editor and viewer but not owner", () => {
    expect(roleAtLeast("editor", "viewer")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("editor", "owner")).toBe(false);
  });
});
