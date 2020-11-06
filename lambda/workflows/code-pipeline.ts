import { WorkflowState } from "../constants";
import { GithubWrapper } from "../github";
import { ExecutionUrl, Workflow } from "./workflow";
import * as aws from "../aws";
import { CODEPIPELINE_CONFIG } from "../env";

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
  private githubBranch: string;

  constructor(event: CodePipelineWorkflowEvent, repo: Repo) {
    super(event, repo);

    if (!CODEPIPELINE_CONFIG) throw new Error("CODEPIPELINE_CONFIG is required for CodePipeline deployment.");
    this.ecrRefRepository = CODEPIPELINE_CONFIG.ecrRefRepository;
    this.pipelineName = CODEPIPELINE_CONFIG.pipelineName;
    this.githubBranch = CODEPIPELINE_CONFIG.githubBranch;

    console.log(`Event captured:\ndetailType: ${event["detail-type"]}\nstate: ${event.detail.state}`);
  }

  getBranchRef(): string {
    return this.githubBranch;
  }

  getExecutionUrl(): ExecutionUrl {
    if (!isCodePipelineEvent(this.event)) throw new Error("Cannot get execution URL from CodeDeploy events.");
    return {
      title: "Show Pipeline on AWS",
      url: `https://ca-central-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.event.detail.pipeline}/executions/${this.event.detail["execution-id"]}/timeline?region=${this.event.region}`,
    };
  }
  getExecutionState(): WorkflowState | undefined {
    if (isCodePipelineEvent(this.event)) {
      switch (this.event.detail.state) {
        case "STARTED":
          return WorkflowState.started;
        case "CANCELED":
        case "STOPPED" as any:
          return WorkflowState.stopped;
        case "FAILED":
          return WorkflowState.failed;
        case "SUCCEEDED": // Ignore Pipeline succeeded as it is handled by CodeDeploy.
        case "SUPERSEDED":
        default:
          return undefined;
      }
    } else if (isCodeDeployEvent(this.event)) {
      switch (this.event.detail.state) {
        case "START":
          if (this.event["detail-type"] === "CodeDeploy Deployment State-change Notification") {
            return WorkflowState.deploying;
          }
          break;
        case "SUCCESS":
          if (this.event["detail-type"] === "CodeDeploy Instance State-change Notification") {
            return WorkflowState.waitingForStabilization;
          } else if (this.event["detail-type"] === "CodeDeploy Deployment State-change Notification") {
            return WorkflowState.finished;
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

    const pipelines = await aws.loadData();

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
    return github.getHeadCommit(this.githubBranch);
  }

  async getLatestDeployedCommitSha(): Promise<string | undefined> {
    return aws.getLatestDeployedCommitShaFromECR(this.ecrRefRepository);
  }
}
