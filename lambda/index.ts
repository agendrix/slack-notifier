import * as aws from "./aws";
import * as slack from "./slack";
import { Context, Callback, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { COLORS, WorkflowState } from "./constants";
import { ENV, REPO, API_SECRET, SLACK_CHANNEL, SLACK_URL } from "./env";
import { getWorkflow as getWorkflowFromSupportedEvent, isSupportedHTTPLambdaRequest } from "./workflows/factory";

type LambdaResponse = APIGatewayProxyStructuredResultV2;

let lambdaCallback: Callback<LambdaResponse> | undefined = undefined;

const context = `\`${REPO.branch}\` of ${REPO.name} to *${ENV}*`;

// prettier-ignore
const STATE_MESSAGES: { [k in keyof typeof WorkflowState]: [color: string, status: string] } = {
  started:                 [COLORS.normal,  `Started deploying ${context}`],
  preMigration:            [COLORS.info,    `Started deploying ${context} (Pre-migrations)`],
  deploying:               [COLORS.info,    `Started deploying ${context} (Updating servers)`],
  waitingForStabilization: [COLORS.info,    `Started deploying ${context} (Waiting for stabilization)`],
  postMigration:           [COLORS.info,    `Started deploying ${context} (Post-migrations)`],
  finished:                [COLORS.success, `*Finished* deploying ${context}`],
  stopped:                 [COLORS.error,   `Deployment *stopped* for ${context}`],
  failed:                  [COLORS.error,   `Deployment *failed* for ${context}`],
};

function sendResponse(message: string, statusCode: number): LambdaResponse {
  const response: LambdaResponse = {
    statusCode,
    body: message,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    isBase64Encoded: false,
  };
  lambdaCallback?.(null, response);
  return response;
}

async function handler(event: any, _context: Context | null, callback?: Callback): Promise<LambdaResponse> {
  lambdaCallback = callback;

  try {
    if (isSupportedHTTPLambdaRequest(event)) {
      if (!API_SECRET) throw new Error("API_SECRET is required for api calls");
      if (event.headers["Authorization"] !== `Bearer ${API_SECRET}`) return sendResponse("Bad Request", 400);
    }

    const workflow = getWorkflowFromSupportedEvent(event);
    if (!workflow) return sendResponse("Unsupported event", 400);

    const workflowState = workflow.getExecutionState();
    if (!workflowState) return sendResponse("Unsupported state", 400);

    const pipelineData = await workflow.getSlackMessageData();
    if (!pipelineData) {
      console.log(`PipelineData not found.\nEvent:\n${JSON.stringify(event)}`);
      return sendResponse("PipelineData not found", 404);
    }

    const [color, statusText] = STATE_MESSAGES[workflowState];
    const attachment = { color, ...pipelineData.messageDetails };

    if (workflowState === WorkflowState.started) {
      const slackResponse = await slack.callApi("chat.postMessage", {
        channel: SLACK_CHANNEL,
        text: statusText,
        attachments: [attachment],
      });

      await aws.savePipelineData(await workflow.getExecutionId(), {
        ...pipelineData,
        initialSlackMessageRef: {
          channel: slackResponse.channel,
          ts: slackResponse.ts,
        },
      });
    } else {
      const endingStates = [WorkflowState.finished, WorkflowState.stopped, WorkflowState.failed];

      if (pipelineData.initialSlackMessageRef) {
        await slack.callApi("chat.update", {
          channel: pipelineData.initialSlackMessageRef.channel,
          ts: pipelineData.initialSlackMessageRef.ts,
          text: endingStates.includes(workflowState) ? STATE_MESSAGES.started[1] : statusText,
          attachments: [attachment],
        });
      }

      if (endingStates.includes(workflowState)) {
        const ref = pipelineData.initialSlackMessageRef;
        await slack.callApi("chat.postMessage", {
          channel: SLACK_CHANNEL,
          attachments: [
            {
              color,
              text: statusText,
              footer: ref
                ? `<https://${SLACK_URL}/archives/${ref.channel}/p${ref.ts.replace(".", "")}|See details>`
                : null,
              ts: Date.now(),
            },
          ],
        });
        await aws.clearPipelineData(pipelineData.executionId);
      }
    }

    return sendResponse("ok", 204);
  } catch (error) {
    console.error(error);
    return sendResponse("Internal server error", 500);
  }
}

exports.handler = handler;

export const __test__ = {
  handler,
  STATE_MESSAGES,
};
