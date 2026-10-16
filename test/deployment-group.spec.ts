/// <reference path="../lambda/app.d.ts" />

import assert from "assert";
import { APIGatewayEvent } from "aws-lambda";

import "./mocks";
import {
  withFakeSlack,
  seedSlackMessage,
  simulateConcurrentPost,
  dropNextUpdates,
  getSlackMessages,
  resetFakeSlack,
  KNOWN_SLACK_USER,
} from "./mocks/libs/slack";
import { mock } from "./mocks/libs/constants";

import { __test__ } from "../lambda/index";
import { __test__ as deploymentGroup, DeploymentGroupPayload } from "../lambda/deployment-group";

const SHA = mock.commits.head.ref;
const NEWER_SHA = "9f3c2a1b8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b";
const ENV = process.env.ENV as string;

const makeEvent = (overrides: Partial<GitHubActionsEvent>): GitHubActionsEvent => ({
  source: "github.actions",
  state: "STARTED",
  githubRunId: "1001",
  githubSha: SHA,
  githubRef: "refs/heads/master",
  previousSha: mock.commits.base.ref,
  group: "staging",
  initiator: "ericmatte",
  ...overrides,
});

const send = (event: GitHubActionsEvent) =>
  __test__.handler(
    ({
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${mock.apiSecret}` },
      httpMethod: "POST",
      body: JSON.stringify(event),
    } as any) as APIGatewayEvent,
    null
  );

const groupMessages = () => getSlackMessages().filter(message => message.metadata?.event_type === "deployment_group");
const threadReplies = () => getSlackMessages().filter(message => message.thread_ts);
const onlyGroupMessage = () => {
  const messages = groupMessages();
  assert.strictEqual(messages.length, 1);
  return messages[0];
};
const bodyOf = (message: { attachments?: any[] }) => message.attachments![0].text as string;

const otherEnvironmentPayload = (group: DeploymentGroup, sha = SHA) => ({
  key: `${mock.repo.owner}/${mock.repo.name}/${sha}/${group}`,
  sha,
  group,
  initiator: "ericmatte",
  changelog: ["<https://commit|Seeded commit>"],
  totalCommits: 1,
  compareUrl: "https://github.com/compare",
  ...(group === "production" ? { release: { state: "pending" } } : {}),
  envs: {
    "staging-eu": { state: "STARTED", at: 0, runUrl: "https://github.com/MockOwner/MockRepo/actions/runs/2002" },
  },
});

describe("Deployment groups", () => {
  beforeEach(() => resetFakeSlack());

  it("posts one message for the commit and group on start", async () => {
    await withFakeSlack(async () => {
      const response = await send(makeEvent({}));
      assert.strictEqual(response.statusCode, 204);
    });

    const message = onlyGroupMessage();
    assert.strictEqual(message.channel, mock.slackConfig.channel);
    assert.ok(message.text!.startsWith(":loading_fast: Deploying `266db80` to *staging*"));
    assert.ok(bodyOf(message).includes("Mock of Head commit"));
    assert.ok(bodyOf(message).includes(`:loading_fast: *${ENV}* · Started`));
    assert.ok(bodyOf(message).includes("merged by @ericmatte"));
    assert.ok(bodyOf(message).includes("<https://github.com/MockOwner/MockRepo/actions/runs/1001|run>"));
  });

  it("joins the message another environment already posted", async () => {
    seedSlackMessage({
      channel: mock.slackConfig.channel,
      text: "seeded",
      metadata: { event_type: "deployment_group", event_payload: otherEnvironmentPayload("staging") },
    });

    const calls = await withFakeSlack(async () => {
      await send(makeEvent({}));
    });

    assert.strictEqual(calls.filter(call => call.method === "chat.postMessage").length, 0);
    const message = onlyGroupMessage();
    assert.ok(bodyOf(message).includes("*staging-eu* · Started"));
    assert.ok(bodyOf(message).includes(`*${ENV}* · Started`));
    assert.ok(message.text!.includes("0/2 done"));
  });

  it("keeps the earliest message when two environments post at the same time", async () => {
    simulateConcurrentPost({
      channel: mock.slackConfig.channel,
      text: "concurrent",
      metadata: { event_type: "deployment_group", event_payload: otherEnvironmentPayload("staging") },
    });

    const calls = await withFakeSlack(async () => {
      await send(makeEvent({}));
    });

    assert.strictEqual(calls.filter(call => call.method === "chat.delete").length, 1);
    const message = onlyGroupMessage();
    assert.ok(bodyOf(message).includes("*staging-eu* · Started"));
    assert.ok(bodyOf(message).includes(`*${ENV}* · Started`));
  });

  it("writes again when another environment overwrote its update", async () => {
    await send(makeEvent({}));
    dropNextUpdates(1);

    const calls = await withFakeSlack(async () => {
      await send(makeEvent({ state: "POST_MIGRATIONS" }));
    });

    assert.strictEqual(calls.filter(call => call.method === "chat.update").length, 2);
    assert.ok(bodyOf(onlyGroupMessage()).includes(`*${ENV}* · Post-migrations`));
  });

  it("shows a finished deployment in green", async () => {
    await send(makeEvent({}));
    await send(makeEvent({ state: "SUCCEEDED" }));

    const message = onlyGroupMessage();
    assert.ok(message.text!.startsWith("✅ Deployed `266db80` to *staging* · 1/1 done"));
    assert.ok(bodyOf(message).includes(`✅ *${ENV}* · Finished`));
    assert.strictEqual(message.attachments![0].color, deploymentGroup.COLORS_BY_STATUS.succeeded);
    assert.strictEqual(threadReplies().length, 0);
  });

  it("names the failed step and mentions the initiator in the thread", async () => {
    await send(makeEvent({ initiatorEmail: KNOWN_SLACK_USER.email }));
    await send(makeEvent({ state: "POST_MIGRATIONS", initiatorEmail: KNOWN_SLACK_USER.email }));
    await send(makeEvent({ state: "FAILED", initiatorEmail: KNOWN_SLACK_USER.email }));

    const message = onlyGroupMessage();
    assert.ok(message.text!.startsWith("❌ Deployed `266db80` to *staging* · 0/1 done, 1 failed"));
    assert.ok(bodyOf(message).includes(`❌ *${ENV}* · Failed at Post-migrations`));

    const replies = threadReplies();
    assert.strictEqual(replies.length, 1);
    assert.strictEqual(replies[0].thread_ts, message.ts);
    assert.ok(replies[0].text!.includes(`❌ *${ENV}* failed at *Post-migrations*`));
    assert.ok(replies[0].text!.includes(`<@${KNOWN_SLACK_USER.id}>`));
  });

  it("writes the GitHub login when Slack does not know the email", async () => {
    await send(makeEvent({ initiatorEmail: "gone@agendrix.com" }));
    await send(makeEvent({ state: "FAILED", initiatorEmail: "gone@agendrix.com" }));

    assert.ok(threadReplies()[0].text!.includes("@ericmatte"));
  });

  it("names the newer commit that replaced a skipped deployment", async () => {
    await send(makeEvent({}));
    seedSlackMessage({
      channel: mock.slackConfig.channel,
      text: "newer",
      metadata: { event_type: "deployment_group", event_payload: otherEnvironmentPayload("staging", NEWER_SHA) },
    });
    await send(makeEvent({ state: "SKIPPED" }));

    const skipped = groupMessages().find(message => message.metadata!.event_payload.sha === SHA)!;
    assert.ok(skipped.text!.startsWith("⏭️ Skipped `266db80` on *staging* · replaced by `9f3c2a1`"));
    assert.strictEqual(skipped.attachments![0].color, deploymentGroup.COLORS_BY_STATUS.skipped);
  });

  it("says there was nothing to deploy when no newer commit replaced it", async () => {
    await send(makeEvent({}));
    await send(makeEvent({ state: "SKIPPED" }));

    assert.ok(onlyGroupMessage().text!.startsWith("⏭️ Skipped `266db80` on *staging* · nothing to deploy"));
  });

  describe("production", () => {
    const production = (overrides: Partial<GitHubActionsEvent>) =>
      makeEvent({ group: "production", initiator: "ageorgaris", ...overrides });

    it("waits for the release while deploying", async () => {
      await send(production({}));

      const body = bodyOf(onlyGroupMessage());
      assert.ok(body.includes("📦 Release pending"));
      assert.ok(body.includes("launched by @ageorgaris"));
      assert.ok(body.includes("Mock of Head commit"));
    });

    it("replaces the commits with the release once it is published", async () => {
      await send(production({}));
      await send(production({ state: "SUCCEEDED" }));
      await send(
        production({
          state: "RELEASE_PUBLISHED",
          releaseName: "16 oct. 2026, 11h11",
          releaseUrl: "https://github.com/agendrix/web/releases/tag/prod-2026-10-16-11h11",
        })
      );

      const body = bodyOf(onlyGroupMessage());
      assert.ok(
        body.includes(
          "📦 Release <https://github.com/agendrix/web/releases/tag/prod-2026-10-16-11h11|*16 oct. 2026, 11h11*>"
        )
      );
      assert.ok(!body.includes("Mock of Head commit"));
      assert.ok(body.includes(`✅ *${ENV}* · Finished`));
      assert.strictEqual(threadReplies().length, 0);
    });

    it("keeps the commits when there is no new release", async () => {
      await send(production({}));
      await send(production({ state: "RELEASE_SKIPPED" }));

      const body = bodyOf(onlyGroupMessage());
      assert.ok(body.includes("📦 No new release"));
      assert.ok(body.includes("Mock of Head commit"));
      assert.strictEqual(threadReplies().length, 0);
    });

    it("reports a failed release in the thread", async () => {
      await send(production({}));
      await send(production({ state: "RELEASE_FAILED", githubRunId: "3003", initiatorEmail: KNOWN_SLACK_USER.email }));

      const message = onlyGroupMessage();
      assert.ok(
        bodyOf(message).includes(
          "📦 Release failed · <https://github.com/MockOwner/MockRepo/actions/runs/3003|Open the run>"
        )
      );
      const replies = threadReplies();
      assert.strictEqual(replies.length, 1);
      assert.ok(replies[0].text!.includes("❌ Release failed"));
      assert.ok(replies[0].text!.includes(`<@${KNOWN_SLACK_USER.id}>`));
    });
  });

  describe("rendering", () => {
    const payload = (overrides: object) =>
      ({
        ...otherEnvironmentPayload("staging"),
        changelog: ["<a|1>", "<b|2>", "<c|3>", "<d|4>", "<e|5>"],
        totalCommits: 7,
        ...overrides,
      } as DeploymentGroupPayload);

    it("shows five commits and links the rest", () => {
      const body = deploymentGroup.renderGroupMessage(payload({})).attachments[0].text;
      assert.ok(body.includes("<e|5>"));
      assert.ok(body.includes("<https://github.com/compare|+2 more>"));
    });

    it("counts the commits when all of them are shown", () => {
      const body = deploymentGroup.renderGroupMessage(payload({ changelog: ["<a|1>"], totalCommits: 1 })).attachments[0]
        .text;
      assert.ok(body.includes("<https://github.com/compare|1 new commit>"));
    });
  });
});
