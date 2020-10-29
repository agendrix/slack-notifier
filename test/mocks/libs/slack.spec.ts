import { withFakeSlack } from "./slack";
import assert from "assert";
import * as Slack from "../../../lambda/slack";

describe("Mock slack", () => {
  it("mock slack callAPI", async () => {
    const method = "TestMethod";
    const options = { some: "options" };

    const calls = await withFakeSlack(async () => {
      await Slack.callApi(method, options);
    });

    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0], { method, options, ts: calls[0].ts });
  });
});
