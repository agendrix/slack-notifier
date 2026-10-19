import { APIGatewayEvent } from "aws-lambda";
import { REPO } from "../env";
import { CodePipelineWorkflow } from "./code-pipeline";
import { GithubActionsWorkflow } from "./github-actions";
import { Workflow } from "./workflow";
import { isDeploymentGroupEvent } from "../deployment-group";

export function isSupportedHTTPLambdaRequest(event: any): event is APIGatewayEvent {
  return event.body && event.httpMethod === "POST" && event?.headers?.["Content-Type"] === "application/json";
}

export const getDeploymentGroupEvent = (event: any): GitHubActionsEvent | undefined => {
  if (!isSupportedHTTPLambdaRequest(event)) return undefined;

  const bodyEvent = JSON.parse(event.body || "{}");
  return GithubActionsWorkflow.isEventSupported(bodyEvent) && isDeploymentGroupEvent(bodyEvent) ? bodyEvent : undefined;
};

export const getWorkflow = (event: any): Workflow<LambdaSupportedEvent> | undefined => {
  if (isSupportedHTTPLambdaRequest(event)) {
    const bodyEvent = JSON.parse(event.body || "{}");
    if (GithubActionsWorkflow.isEventSupported(bodyEvent)) {
      return new GithubActionsWorkflow(bodyEvent, REPO);
    }
  } else if (CodePipelineWorkflow.isEventSupported(event)) {
    return new CodePipelineWorkflow(event, REPO);
  }

  return undefined;
};
