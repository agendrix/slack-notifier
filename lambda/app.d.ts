import { CodePipelineCloudWatchPipelineEvent } from "aws-lambda";

declare global {
  type GithubActionsEventState =
    | "STARTED"
    | "PRE_MIGRATIONS"
    | "DEPLOYING"
    | "POST_MIGRATIONS"
    | "STOPPED"
    | "FAILED"
    | "SUCCEEDED";

  interface GitHubActionsEvent {
    state: GithubActionsEventState;
    source: "github.actions";
    githubRunId: string;
    githubSha: string;
    previousSha?: string | undefined;
  }

  interface CodePipelineEvent extends CodePipelineCloudWatchPipelineEvent {}

  interface CodeDeployEvent {
    "version": string;
    "id": string;
    "detail-type": "CodeDeploy Deployment State-change Notification" | "CodeDeploy Instance State-change Notification";
    "source": "aws.codedeploy";
    "account": string;
    "time": string;
    "region": string;
    "resources": string[];
    "detail": {
      region: string;
      deploymentId: string;
      instanceGroupId: string;
      deploymentGroup: string;
      state: "START" | "SUCCESS" | "READY" | "FAILURE";
      instanceId: string;
      application: string;
    };
  }

  type LambdaSupportedEvent = GitHubActionsEvent | CodePipelineEvent | CodeDeployEvent;

  interface Repo {
    owner: string;
    name: string;
    branch: string;
  }

  interface S3SavedPipeline {
    executionId: string;
    messageDetails: {
      ts: number;
      pretext: string;
      text: string;
      footer?: string;
    };
    initialSlackMessageRef?: {
      channel: string;
      ts: string;
    };
  }

  type WorkflowData = {
    [index: string]: S3SavedPipeline;
  };
}
