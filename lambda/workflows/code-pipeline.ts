import { PipelineState } from "../constants";
import { GithubWrapper } from "../github";
import { ExecutionUrl, Workflow } from "./workflow";
import * as aws from "../aws";
import { ECR_REF_REPOSITORY, PIPELINE_NAME } from "../env";

function isCodePipelineEvent(event: LambdaSupportedEvent): event is CodePipelineEvent {
  return event.source === "aws.codepipeline";
}

function isCodeDeployEvent(event: LambdaSupportedEvent): event is CodeDeployEvent {
  return event.source === "aws.codedeploy";
}

type CodePipelineWorkflowEvent = CodePipelineEvent | CodeDeployEvent;

export class CodePipelineWorkflow extends Workflow<CodePipelineWorkflowEvent> {
  static isEventSupported(event: any): event is CodePipelineWorkflowEvent {
    return isCodePipelineEvent(event) || isCodeDeployEvent(event);
  }

  private currentExecutionId: string | undefined;
  private ecrRefRepository: string;
  private pipelineName: string;

  constructor(event: CodePipelineWorkflowEvent, repo: Repo) {
    super(event, repo);

    if (!ECR_REF_REPOSITORY) throw new Error("ECR_REF_REPOSITORY is required for CodePipeline deployment.");
    if (!PIPELINE_NAME) throw new Error("PIPELINE_NAME is required for CodePipeline deployment.");
    this.ecrRefRepository = ECR_REF_REPOSITORY;
    this.pipelineName = PIPELINE_NAME;

    console.log(`Event captured:\ndetailType: ${event["detail-type"]}\nstate: ${event.detail.state}`);
  }

  getExecutionUrl(): ExecutionUrl {
    if (!isCodePipelineEvent(this.event)) throw new Error("Cannot get execution URL from CodeDeploy events.");
    return {
      title: "View Pipeline in AWS",
      url: `https://ca-central-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.event.detail.pipeline}/executions/${this.event.detail["execution-id"]}/timeline?region=${this.event.region}`,
    };
  }
  getExecutionState(): PipelineState | undefined {
    if (isCodePipelineEvent(this.event)) {
      switch (this.event.detail.state) {
        case "STARTED":
          return PipelineState.started;
        case "STOPPED":
          return PipelineState.stopped;
        case "FAILED":
          return PipelineState.failed;
        case "SUCCEEDED": // Ignore Pipeline succeeded as it is handled by CodeDeploy.
        case "SUPERSEDED":
        case "STOPPING":
        default:
          return undefined;
      }
    } else if (isCodeDeployEvent(this.event)) {
      switch (this.event.detail.state) {
        case "START":
          if (this.event["detail-type"] === "CodeDeploy Deployment State-change Notification") {
            return PipelineState.deploying;
          }
          break;
        case "SUCCESS":
          if (this.event["detail-type"] === "CodeDeploy Instance State-change Notification") {
            return PipelineState.waitingForStabilization;
          } else if (this.event["detail-type"] === "CodeDeploy Deployment State-change Notification") {
            return PipelineState.finished;
          }
          break;
        case "READY":
        case "FAILURE": // Will be handled by the CodePipeline.
        default:
          break;
      }
    }
    return undefined;
  }

  async getExecutionId(): Promise<string> {
    if (this.currentExecutionId) {
      return this.currentExecutionId;
    }

    const pipelines = await aws.loadPipelines();

    let executionId: string | undefined;
    if (isCodePipelineEvent(this.event)) {
      executionId = this.event.detail["execution-id"];
    } else if (isCodeDeployEvent(this.event)) {
      executionId = await aws.findPipelineExecutionId(this.pipelineName, pipelines, this.event.detail.deploymentId);
    }

    if (!executionId) throw new Error(`Execution id not found for pipeline '${this.pipelineName}'.`);
    this.currentExecutionId = executionId;
    return this.currentExecutionId;
  }

  async getExecutionCommitSha(github: GithubWrapper): Promise<string> {
    return github.getHeadCommit();
  }

  async getLatestDeployedCommitSha(): Promise<string | undefined> {
    return aws.getLatestDeployedCommitShaFromECR(this.ecrRefRepository);
  }
}
