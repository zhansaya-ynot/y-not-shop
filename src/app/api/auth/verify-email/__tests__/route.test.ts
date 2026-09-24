import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as verifyPOST } from "../route";
import { POST as resendPOST } from "../resend/route";
import { prisma } from "@/server/db/client";
import { issueVerificationToken } from "@/server/auth/codes";
import { resetDb } from "@/server/__tests__/helpers/reset-db";
import * as promos from "@/server/promos/welcome";

vi.mock("@/server/auth/csrf", () => ({ assertCsrf: vi.fn() }));
vi.mock("@/server/email", () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ id: "msg_test" }),
  }),
}));

function reqVerify(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}
function reqResend(body: unknown): Request {
  return new Request("http://localhost/api/auth/verify-email/resend", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/verify-email", () => {
  beforeEach(() => resetDb());

  it("marks the user verified on a correct code", async () => {
    const u = await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h" },
    });
    const code = await issueVerificationToken("verify", "u@x.com");
    const res = await verifyPOST(reqVerify({ email: "u@x.com", code }));
    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("returns 401 INVALID_CODE for a wrong code", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    await issueVerificationToken("verify", "u@x.com");
    const res = await verifyPOST(reqVerify({ email: "u@x.com", code: "000000" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 on missing fields", async () => {
    const res = await verifyPOST(reqVerify({ email: "x" }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/auth/verify-email/resend", () => {
  beforeEach(() => resetDb());

  it("issues a fresh code for an unverified user", async () => {
    await prisma.user.create({ data: { email: "u@x.com", passwordHash: "$2b$10$h" } });
    const res = await resendPOST(reqResend({ email: "u@x.com" }));
    expect(res.status).toBe(200);
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: "verify:u@x.com" },
    });
    expect(tokens).toHaveLength(1);
  });

  it("returns 404 when there is no pending verification (user already verified or absent)", async () => {
    await prisma.user.create({
      data: { email: "u@x.com", passwordHash: "$2b$10$h", emailVerifiedAt: new Date() },
    });
    const res = await resendPOST(reqResend({ email: "u@x.com" }));
    expect(res.status).toBe(404);
  });
});

describe("welcome discount on verification", () => {
  beforeEach(() => resetDb());

  it("awards the discount the first time an address is confirmed", async () => {
    await prisma.user.create({
      data: { email: "robyn@x.com", name: "Robyn", passwordHash: "$2b$10$h" },
    });
    const code = await issueVerificationToken("verify", "robyn@x.com");

    const res = await verifyPOST(reqVerify({ email: "robyn@x.com", code }));

    expect(res.status).toBe(200);
    const job = await prisma.emailJob.findFirst({ where: { template: "WelcomeDiscount" } });
    expect(job?.recipientEmail).toBe("robyn@x.com");
    const promo = await prisma.promoCode.findFirst();
    expect(promo?.discountValue).toBe(10);
    expect(promo?.usageLimit).toBe(1);
  });

  it("does not hand a second discount to someone who verifies again", async () => {
    await prisma.user.create({
      data: {
        email: "robyn@x.com",
        passwordHash: "$2b$10$h",
        emailVerifiedAt: new Date("2026-09-23T15:17:00Z"),
      },
    });
    const code = await issueVerificationToken("verify", "robyn@x.com");

    const res = await verifyPOST(reqVerify({ email: "robyn@x.com", code }));

    expect(res.status).toBe(200);
    expect(await prisma.promoCode.count()).toBe(0);
    expect(await prisma.emailJob.count({ where: { template: "WelcomeDiscount" } })).toBe(0);
  });

  it("still confirms the address if issuing the discount fails", async () => {
    // Verification is the customer's way into their account — a failure in
    // the perk must never block it.
    const user = await prisma.user.create({
      data: { email: "robyn@x.com", passwordHash: "$2b$10$h" },
    });
    const spy = vi
      .spyOn(promos, "issueWelcomePromo")
      .mockRejectedValue(new Error("promo service down"));
    const code = await issueVerificationToken("verify", "robyn@x.com");

    const res = await verifyPOST(reqVerify({ email: "robyn@x.com", code }));

    expect(res.status).toBe(200);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.emailVerifiedAt).toBeInstanceOf(Date);
    // Proves the stub actually took effect — without it a code would exist
    // and this test would pass for the wrong reason.
    expect(spy).toHaveBeenCalledOnce();
    expect(await prisma.promoCode.count()).toBe(0);
    spy.mockRestore();
  });
});
