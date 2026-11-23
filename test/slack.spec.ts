import assert from "assert";
import request from "request";

import "./mocks";
import { buildRequest } from "../lambda/slack";

const wireRequest = (method: string, options: any) => {
  const slackRequest = request(buildRequest(method, options));
  slackRequest.abort();
  return {
    contentType: slackRequest.getHeader("content-type"),
    body: (slackRequest as any).body.toString(),
  };
};

describe("Slack request", () => {
  it("sends users.lookupByEmail form-encoded, since Slack ignores a JSON body there", () => {
    const { contentType, body } = wireRequest("users.lookupByEmail", { email: "known+test@agendrix.com" });

    assert.ok(contentType.startsWith("application/x-www-form-urlencoded"));
    assert.strictEqual(body, "email=known%2Btest%40agendrix.com");
  });

  it("parses the JSON response of a form-encoded call", () => {
    assert.strictEqual(buildRequest("users.lookupByEmail", { email: "known@agendrix.com" }).json, true);
  });

  it("sends the other methods as JSON", () => {
    const { contentType, body } = wireRequest("chat.postMessage", { channel: "C123", metadata: { a: 1 } });

    assert.strictEqual(contentType, "application/json");
    assert.deepStrictEqual(JSON.parse(body), { channel: "C123", metadata: { a: 1 } });
  });
});
