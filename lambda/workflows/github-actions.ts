import { PipelineState } from "../constants";
import { ExecutionUrl, Workflow } from "./workflow";

const GH_ACTIONS_EXECUTION_STATES: { [k in GithubActionsEventState]: PipelineState } = {
  STARTED: PipelineState.started,
  PRE_MIGRATIONS: PipelineState.preMigration,
  DEPLOYING: PipelineState.deploying,
  POST_MIGRATIONS: PipelineState.postMigration,
  STOPPED: PipelineState.stopped,
  FAILED: PipelineState.failed,
  SUCCEEDED: PipelineState.finished,
};

export class GithubActionsWorkflow extends Workflow<GitHubActionsEvent> {
  static isEventSupported(event: any): event is GitHubActionsEvent {
    return event.source === "github.actions";
  }

  constructor(event: GitHubActionsEvent, repo: Repo) {
    super(event, repo);
    console.log(`Event captured:\ndetailType: GitHub Actions Event\nstate: ${event.state}`);
  }

  getExecutionUrl(): ExecutionUrl {
    return {
      title: "View Pipeline in GitHub Actions",
      url: `https://github.com/${this.repo.owner}/${this.repo.name}/actions/runs/${this.event.githubRunId}`,
    };
  }

  getExecutionState(): PipelineState | undefined {
    return GH_ACTIONS_EXECUTION_STATES[this.event.state];
  }

  async getExecutionId(): Promise<string> {
    return new Promise(resolve => resolve(this.event.githubRunId));
  }
  async getExecutionCommitSha(): Promise<string> {
    return new Promise(resolve => resolve(this.event.githubSha));
  }

  async getLatestDeployedCommitSha(): Promise<string | undefined> {
    return this.event.previousSha || undefined;
  }
}
