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
    githubRef: string;
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
  }

  type BaseWorkflowItem = {
    executionId: string;
    messageDetails: {
      pretext?: string;
      text: string;
      footer?: string;
    };
  };

  type WorkflowItem = BaseWorkflowItem & {
    isSaved: true;
    slackMessageRef: {
      channel: string;
      ts: string;
    };
  };

  type NewWorkflowItem = BaseWorkflowItem & {
    isSaved: false;
  };

  type WorkflowData = {
    [index: string]: WorkflowItem;
  };

  type SlackConfig = {
    channel: string;
    url: string;
    accessToken: string;
  };

  type CodepipelineConfig = {
    pipelineName: string;
    ecrRefRepository: string;
    githubBranch: string;
  };

  type S3Config = {
    bucket: string;
    key: string;
  };
}
