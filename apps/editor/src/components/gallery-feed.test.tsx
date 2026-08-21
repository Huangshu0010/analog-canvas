import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GalleryFeed, loadGalleryFeed } from "./gallery-feed";

function fetchReturning(payload: unknown, ok = true): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status: ok ? 200 : 502,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

describe("loadGalleryFeed", () => {
  it("returns ready entries from the worker", async () => {
    const state = await loadGalleryFeed(
      fetchReturning({
        entries: [
          {
            id: "g1",
            name: "Ring",
            author: "tz",
            description: "",
            createdAt: "2026-08-21T00:00:00.000Z",
            schemaVersion: 21,
          },
        ],
      }),
    );
    expect(state).toMatchObject({ status: "ready" });
    if (state.status === "ready") {
      expect(state.entries.map((entry) => entry.id)).toEqual(["g1"]);
    }
  });

  it("degrades to unavailable on errors and non-OK responses", async () => {
    expect(await loadGalleryFeed(fetchReturning({}, false))).toEqual({
      status: "unavailable",
    });
    const throwing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await loadGalleryFeed(throwing)).toEqual({
      status: "unavailable",
    });
  });
});

describe("GalleryFeed", () => {
  it("renders the landing chrome and editor entry point", () => {
    const markup = renderToStaticMarkup(createElement(GalleryFeed));
    expect(markup).toContain('data-testid="gallery-feed"');
    expect(markup).toContain("Analog Canvas");
    expect(markup).toContain('data-testid="gallery-new-circuit"');
    expect(markup).toContain('href="/editor"');
    expect(markup).toContain('data-testid="gallery-loading"');
  });
});
