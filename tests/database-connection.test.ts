import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeConnectionString } from "../server/db";
import { sendJsonError } from "../server/handler";

test("Vercel SSL settings cannot be disabled by connection-string parameters", () => {
  const sanitized = sanitizeConnectionString(
    "postgresql://user:password@db.example.test/app?sslmode=disable&sslrootcert=%2Ftmp%2Fca.pem&channel_binding=require&application_name=vercel",
    true,
  );
  const url = new URL(sanitized);

  assert.equal(url.searchParams.has("sslmode"), false);
  assert.equal(url.searchParams.has("sslrootcert"), false);
  assert.equal(url.searchParams.has("channel_binding"), false);
  assert.equal(url.searchParams.get("application_name"), "vercel");
});

test("non-serverless connection strings retain their SSL mode", () => {
  const sanitized = sanitizeConnectionString(
    "postgresql://user:password@db.example.test/app?sslmode=verify-full&channel_binding=require",
    false,
  );
  const url = new URL(sanitized);

  assert.equal(url.searchParams.get("sslmode"), "verify-full");
  assert.equal(url.searchParams.has("channel_binding"), false);
});

test("initialization errors can respond through a native Node response", () => {
  const response: {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    setHeader: (name: string, value: string) => void;
    end: (body: string) => void;
  } = {
    headers: {},
    setHeader(name, value) {
      this.headers![name] = value;
    },
    end(body) {
      this.body = body;
    },
  };

  sendJsonError(response, 503, {
    code: "HANDLER_INITIALIZATION_FAILED",
    message: "Service initialization failed.",
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.headers?.["Content-Type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(response.body!), {
    code: "HANDLER_INITIALIZATION_FAILED",
    message: "Service initialization failed.",
  });
});
