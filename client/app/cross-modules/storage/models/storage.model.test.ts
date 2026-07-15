import { describe, expect, it } from "vitest";

import { DmsItemType, STORAGE_STRATEGIES } from "./storage.model";

describe("storage/models/storage.model", () => {
  describe("STORAGE_STRATEGIES", () => {
    it("should expose the four supported strategies", () => {
      expect(STORAGE_STRATEGIES).toHaveLength(4);
      expect(STORAGE_STRATEGIES.map((s) => s.value)).toEqual([
        "Amazon",
        "Azure",
        "SftpStorage",
        "S3Compatible",
      ]);
    });

    it("should give each strategy a stable id and label", () => {
      const aws = STORAGE_STRATEGIES.find((s) => s.value === "Amazon");
      expect(aws).toEqual({ id: "aws", label: "AWS", value: "Amazon" });
    });
  });

  describe("DmsItemType", () => {
    it("should map File to 1 and Folder to 2", () => {
      expect(DmsItemType.File).toBe(1);
      expect(DmsItemType.Folder).toBe(2);
    });

    it("should be reverse-mappable (numeric enum)", () => {
      expect(DmsItemType[1]).toBe("File");
      expect(DmsItemType[2]).toBe("Folder");
    });
  });
});
