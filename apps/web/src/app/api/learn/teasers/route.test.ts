import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@repo/shared", async () => {
  const actual = await vi.importActual<typeof import("@repo/shared")>(
    "@repo/shared",
  );
  return {
    ...actual,
    checkRateLimit: vi.fn(),
  };
});

vi.mock("@repo/ai", () => ({
  generateTeaserCardsStream: vi.fn(),
}));

import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@repo/shared";
import { generateTeaserCardsStream } from "@repo/ai";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/learn/teasers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  topic: "Linear algebra",
  goalType: "skill_building",
  currentLevel: "some_knowledge",
};

function mockAuthed(userId: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({
          data: { user: userId ? { id: userId } : null },
        }),
    },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/learn/teasers", () => {
  it("returns 401 when there is no user session", async () => {
    mockAuthed(null);
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockAuthed("u1");
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: false,
      retryAfterMs: 5_000,
    });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });

  it("returns 400 on malformed body", async () => {
    mockAuthed("u1");
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    });
    const res = await POST(makeReq({ topic: "" }));
    expect(res.status).toBe(400);
  });

  it("returns a text/event-stream response on happy path", async () => {
    mockAuthed("u1");
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    });
    // Stream that yields nothing and returns immediately.
    vi.mocked(generateTeaserCardsStream).mockImplementation(
      // eslint-disable-next-line require-yield
      async function* () {
        return;
      } as never,
    );

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("emits an event: card frame for each yielded card", async () => {
    mockAuthed("u1");
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
    });
    vi.mocked(generateTeaserCardsStream).mockImplementation(
      async function* () {
        yield { keyword: "Vectors", blurb: "Arrows with a job." };
        yield { keyword: "Matrices", blurb: "Transformations in a grid." };
      } as never,
    );

    const res = await POST(makeReq(validBody));
    expect(res.body).not.toBeNull();
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value);
    }

    expect(buf).toContain("event: card");
    expect(buf).toContain("Vectors");
    expect(buf).toContain("Matrices");
    expect(buf).toContain("event: done");
  });
});
