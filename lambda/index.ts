import * as aws from "./aws";
import * as slack from "./slack";
import { Context, Callback, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { COLORS, WorkflowState } from "./constants";
import { ENV, REPO, API_SECRET, SLACK_CONFIG } from "./env";
import { getWorkflow as getWorkflowFromSupportedEvent, isSupportedHTTPLambdaRequest } from "./workflows/factory";

type LambdaResponse = APIGatewayProxyStructuredResultV2;

// prettier-ignore
const STATE_MESSAGES: { [k in keyof typeof WorkflowState]: [color: string, getStatus: (ref: string) => string] } = {
  started:                 [COLORS.normal,  ref => `Started deploying ${ref}`],
  preMigration:            [COLORS.info,    ref => `Started deploying ${ref} (Pre-migrations)`],
  deploying:               [COLORS.info,    ref => `Started deploying ${ref} (Updating servers)`],
  waitingForStabilization: [COLORS.info,    ref => `Started deploying ${ref} (Waiting for stabilization)`],
  postMigration:           [COLORS.info,    ref => `Started deploying ${ref} (Post-migrations)`],
  finished:                [COLORS.success, ref => `*Finished* deploying ${ref}`],
  stopped:                 [COLORS.warning, ref => `Deployment *stopped* for ${ref}`],
  failed:                  [COLORS.error,   ref => `Deployment *failed* for ${ref}`],
  skipped:                 [COLORS.warning, ref => `Deployment *skipped* for ${ref}`],
};

const ENDING_STATES: WorkflowState[] = [WorkflowState.finished, WorkflowState.stopped, WorkflowState.failed, WorkflowState.skipped];

let lambdaCallback: Callback<LambdaResponse> | undefined = undefined;

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

    const data = await workflow.getSlackMessageData();
    if (!data) {
      console.log(`Workflow data not found.\nEvent:\n${JSON.stringify(event)}`);
      return sendResponse("Workflow data not found", 404);
    }

    const contextRef = `\`${workflow.getBranchRef()}\` of *${REPO.name}* to *${ENV}*`;
    const [color, getStatusText] = STATE_MESSAGES[workflowState];
    const statusText = getStatusText(contextRef);
    const ts = Date.now();
    const attachment = { color, ts, ...data.messageDetails };

    if (data.isSaved === false) {
      const messageRef = await slack.callApi("chat.postMessage", {
        channel: SLACK_CONFIG.channel,
        text: statusText,
        attachments: [attachment],
      });

      await aws.saveItem(await workflow.getExecutionId(), {
        ...data,
        isSaved: true,
        slackMessageRef: { channel: messageRef.channel, ts: messageRef.ts },
      });
    } else {
      await slack.callApi("chat.update", {
        channel: data.slackMessageRef.channel,
        text: statusText,
        ts: data.slackMessageRef.ts,
        attachments: [attachment],
      });

      if (workflowState === WorkflowState.failed) {
        // Post a second message if the flow failed
        const ref = data.slackMessageRef;
        await slack.callApi("chat.postMessage", {
          channel: SLACK_CONFIG.channel,
          attachments: [
            {
              color,
              text: statusText,
              footer: `<https://${SLACK_CONFIG.url}/archives/${ref.channel}/p${ref.ts.replace(".", "")}|See details>`,
              ts,
            },
          ],
        });
      }

      if (ENDING_STATES.includes(workflowState)) {
        await aws.removeItem(data.executionId);
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
