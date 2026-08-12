import { describe, expect, it } from "vitest";

import { createEmptyProject } from "@icm/model";

import {
  readProjectFromHandle,
  writeProjectToHandle,
  type BrowserProjectFileHandle,
} from "./file-system-access.js";

describe("optional browser file handles", () => {
  it("writes canonical Project text only after write permission is granted", async () => {
    const writes: string[] = [];
    const handle: BrowserProjectFileHandle = {
      kind: "file",
      name: "test.icproj.json",
      async getFile() {
        return new File(["{}"], this.name);
      },
      async queryPermission() {
        return "granted";
      },
      async createWritable() {
        return {
          async write(text) {
            writes.push(text);
          },
          async close() {},
        };
      },
    };
    await expect(
      writeProjectToHandle(handle, createEmptyProject("handle", "Handle")),
    ).resolves.toBe("written");
    expect(writes[0]).toContain('"schemaVersion": 3');
  });

  it("does not write when permission is denied", async () => {
    const handle: BrowserProjectFileHandle = {
      kind: "file",
      name: "test.icproj.json",
      async getFile() {
        return new File(["{}"], this.name);
      },
      async queryPermission() {
        return "denied";
      },
      async createWritable() {
        throw new Error("must not write");
      },
    };
    await expect(
      writeProjectToHandle(handle, createEmptyProject("handle", "Handle")),
    ).resolves.toBe("permission-denied");
  });

  it("parses a Project read from a user-selected handle", async () => {
    const project = createEmptyProject("opened", "Opened");
    const handle: BrowserProjectFileHandle = {
      kind: "file",
      name: "opened.icproj.json",
      async getFile() {
        return new File([JSON.stringify(project)], this.name);
      },
      async createWritable() {
        throw new Error("not used");
      },
    };
    await expect(readProjectFromHandle(handle)).resolves.toEqual(project);
  });
});
