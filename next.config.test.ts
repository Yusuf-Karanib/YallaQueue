import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("Next.js production headers", () => {
  it("hides the framework header and adds browser security headers", async () => {
    const rules = await nextConfig.headers?.();
    const headers = Object.fromEntries(
      (rules?.[0]?.headers ?? []).map((header) => [header.key, header.value]),
    );

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(rules?.[0]?.source).toBe("/:path*");
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
