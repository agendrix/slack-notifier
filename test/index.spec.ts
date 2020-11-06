/// <reference path="../lambda/app.d.ts" />

import assert from "assert";
import { APIGatewayEvent } from "aws-lambda";

import "./mocks";
import { withFakeSlack, FakeSlackCall } from "./mocks/libs/slack";
import { mock } from "./mocks/libs/constants";

import { __test__ } from "../lambda/index";
import { WorkflowState } from "../lambda/constants";
import {
  codeDeployInstanceSuccess,
  codeDeploySuccess,
  codePipelineFailed,
  codePipelineStarted,
  codePipelineSuperseded,
  githubActionsDeploying,
  githubActionsFailed,
  githubActionsPostMigrations,
  githubActionsPreMigrations,
  githubActionsStarted,
  githubActionsStopped,
  githubActionsSucceeded,
} from "./mocks/events";

const lambdaHandler = (event: any) => __test__.handler(event, null);

// Disable logs
if (false) {
  console.log = () => {};
  console.error = () => {};
}

function getExpectedMessage(status: keyof typeof WorkflowState): string {
  const contextRef = `\`${mock.codepipelineConfig.githubBranch}\` of *${mock.repo.name}* to *${process.env.ENV}*`;
  const [, getStatus] = __test__.STATE_MESSAGES[status];
  return getStatus(contextRef);
}

function assertFirstSlackMessage(call: FakeSlackCall, status: keyof typeof WorkflowState, isAnUpdate = false) {
  assert.strictEqual(call.method, isAnUpdate ? "chat.update" : "chat.postMessage");
  assert.strictEqual(call.options.text, getExpectedMessage(status));
  assert.strictEqual(call.options.channel, mock.slackConfig.channel);

  assert.ok(call.options.attachments[0].footer.includes(mock.commits.base.ref));
  assert.ok(call.options.attachments[0].footer.includes(mock.commits.head.ref));
}

function assertLastSlackMessage(call: FakeSlackCall, firstCallRef: FakeSlackCall, status: keyof typeof WorkflowState) {
  assertFirstSlackMessage(firstCallRef, "started");

  assert.strictEqual(call.method, "chat.postMessage");
  assert.strictEqual(call.options.attachments[0].text, getExpectedMessage(status));
  assert.strictEqual(call.options.channel, mock.slackConfig.channel);
  assert.ok(
    call.options.attachments[0].footer.includes(`/${firstCallRef.options.channel}/p${firstCallRef.ts}`),
    "Link to the first slack message"
  );
}

describe("exports.handler", () => {
  describe("GitHub Actions", () => {
    const makeHttpRequest = (githubActionsEvent: any, bearerToken: string | null): APIGatewayEvent => {
      return ({
        headers: {
          "Content-Type": "application/json",
          "Authorization": bearerToken ? `Bearer ${bearerToken}` : null,
        },
        httpMethod: "POST",
        body: JSON.stringify(githubActionsEvent),
      } as any) as APIGatewayEvent;
    };

    const lambdaHandlerAPICall = (event: any) => {
      return lambdaHandler(makeHttpRequest(event, mock.apiSecret));
    };

    it("returns 404 when a pipeline is not found", async () => {
      const response = await lambdaHandlerAPICall(githubActionsDeploying);
      assert.strictEqual(response.statusCode, 404);
      assert.strictEqual(response.body, "Workflow data not found");
    });

    it("cannot call Slack without the secret token", async () => {
      const response = await lambdaHandler(makeHttpRequest(githubActionsStarted, null));
      assert.strictEqual(response.statusCode, 400);
    });

    it("can call Slack with the secret token", async () => {
      const response = await lambdaHandler(makeHttpRequest(githubActionsStarted, mock.apiSecret));
      assert.strictEqual(response.statusCode, 204);
    });

    it("call Slack multiple times for a complete successful flow", async () => {
      const calls = await withFakeSlack(async () => {
        await lambdaHandlerAPICall(githubActionsStarted);
        await lambdaHandlerAPICall(githubActionsPreMigrations);
        await lambdaHandlerAPICall(githubActionsDeploying);
        await lambdaHandlerAPICall(githubActionsPostMigrations);
        await lambdaHandlerAPICall(githubActionsSucceeded);
      });

      assert.strictEqual(calls.length, 6);
      assertFirstSlackMessage(calls[0], "started");
      assertFirstSlackMessage(calls[1], "preMigration", true);
      assertFirstSlackMessage(calls[2], "deploying", true);
      assertFirstSlackMessage(calls[3], "postMigration", true);
      assertFirstSlackMessage(calls[4], "started", true); // Reset first message on finished
      assertLastSlackMessage(calls[5], calls[0], "finished");
    });

    describe("Unsuccessful flows", () => {
      let firstMessage: FakeSlackCall;

      beforeEach(async () => {
        // Start message from GitHub Actions
        const calls = await withFakeSlack(async () => {
          await lambdaHandlerAPICall(githubActionsStarted);
        });

        assert.strictEqual(calls.length, 1);
        assertFirstSlackMessage(calls[0], "started");
        firstMessage = calls[0];
      });

      it("call Slack for stopped deployment", async () => {
        const calls = await withFakeSlack(async () => {
          await lambdaHandlerAPICall(githubActionsStopped);
        });

        assert.strictEqual(calls.length, 2);
        assertFirstSlackMessage(calls[0], "started", true);
        assertLastSlackMessage(calls[1], firstMessage, "stopped");
      });

      it("call Slack for failed deployment", async () => {
        const calls = await withFakeSlack(async () => {
          await lambdaHandlerAPICall(githubActionsFailed);
        });

        assert.strictEqual(calls.length, 2);
        assertFirstSlackMessage(calls[0], "started", true);
        assertLastSlackMessage(calls[1], firstMessage, "failed");
      });
    });
  });

  describe("Code Pipeline", () => {
    it("returns 404 when a pipeline is not found", async () => {
      const response = await lambdaHandler(codeDeploySuccess);
      assert.strictEqual(response.statusCode, 404);
      assert.strictEqual(response.body, "Workflow data not found");
    });

    it("call Slack for Started event", async () => {
      const calls = await withFakeSlack(async () => {
        await lambdaHandler(codePipelineStarted);
      });

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0].method, "chat.postMessage");
      assertFirstSlackMessage(calls[0], "started");
    });

    it("call Slack for Failed event", async () => {
      const calls = await withFakeSlack(async () => {
        await lambdaHandler(codePipelineStarted);
        await lambdaHandler(codePipelineFailed);
      });

      assert.strictEqual(calls.length, 3);
      assertFirstSlackMessage(calls[0], "started");
      assertFirstSlackMessage(calls[1], "started", true);
      assertLastSlackMessage(calls[2], calls[0], "failed");
    });

    it("ignores other pipeline events", async () => {
      const calls = await withFakeSlack(async () => {
        await lambdaHandler(codePipelineSuperseded);
      });

      assert.strictEqual(calls.length, 0);
    });
  });

  describe("Code Deploy", () => {
    let firstMessage: FakeSlackCall;

    beforeEach(async () => {
      // Start message from CodePipeline
      const calls = await withFakeSlack(async () => {
        await lambdaHandler(codePipelineStarted);
      });

      assert.strictEqual(calls.length, 1);
      assertFirstSlackMessage(calls[0], "started");
      firstMessage = calls[0];
    });

    it("call Slack for Instance Success event", async () => {
      const calls = await withFakeSlack(async () => {
        await lambdaHandler(codeDeployInstanceSuccess);
      });

      assert.strictEqual(calls.length, 1);
      assertFirstSlackMessage(calls[0], "waitingForStabilization", true);
    });

    it("call Slack for Success event", async () => {
      const calls = await withFakeSlack(async () => {
        await lambdaHandler(codeDeploySuccess);
      });

      assert.strictEqual(calls.length, 2);
      assertFirstSlackMessage(calls[0], "started", true);
      assertLastSlackMessage(calls[1], firstMessage, "finished");
    });
  });

  it("ignores unsupported event", async () => {
    const calls = await withFakeSlack(async () => {
      await lambdaHandler({ event: "unsupported" } as any);
    });

    assert.strictEqual(calls.length, 0);
  });
});
