import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import type { ProjectStorage } from "@icm/model";

export type AtomicWriteFaultPoint = "after-flush-before-replace";

export interface RootedStorageOptions {
  onFaultPoint?: (point: AtomicWriteFaultPoint) => void | Promise<void>;
}

export class RootedProjectStorage implements ProjectStorage {
  readonly root: string;
  readonly #options: RootedStorageOptions;

  constructor(root: string, options: RootedStorageOptions = {}) {
    this.root = resolve(root);
    this.#options = options;
  }

  resolvePath(path: string): string {
    const target = resolve(this.root, path);
    const relation = relative(this.root, target);
    if (
      relation === "" ||
      (!relation.startsWith("..") && !isAbsolute(relation))
    ) {
      return target;
    }
    throw new Error(`Path is outside the configured storage root: ${path}`);
  }

  async readText(path: string): Promise<string> {
    return readFile(this.resolvePath(path), "utf8");
  }

  async removeText(path: string): Promise<void> {
    await rm(this.resolvePath(path), { force: true });
  }

  async writeTextAtomically(path: string, content: string): Promise<void> {
    const target = this.resolvePath(path);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
      await handle.close();
      await this.#options.onFaultPoint?.("after-flush-before-replace");
      await rename(temporary, target);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
