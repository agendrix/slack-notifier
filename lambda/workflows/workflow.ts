import { WorkflowState } from "../constants";
import { GithubWrapper } from "../github";
import * as aws from "../aws";

const MAX_NUMBER_OF_COMMITS_TO_SHOW = 40;

export type ExecutionUrl = { url: string; title: string };
export type ExecutionData = { commitSha: string; executionId: string };

export abstract class Workflow<SupportedEvent> {
  constructor(protected event: SupportedEvent, protected repo: Repo) {}
  abstract getBranchRef(): string;
  abstract getExecutionUrl(): ExecutionUrl;
  abstract getExecutionState(): WorkflowState | undefined;
  abstract async getExecutionId(): Promise<string>;
  abstract async getExecutionCommitSha(github: GithubWrapper): Promise<string>;
  abstract async getLatestDeployedCommitSha(): Promise<string | undefined>;

  async getSlackMessageData(): Promise<WorkflowItem | NewWorkflowItem | undefined> {
    if (this.getExecutionState() === WorkflowState.started) {
      return this.getFirstSlackMessageData();
    }

    try {
      const pipelines = await aws.loadData();
      return pipelines[await this.getExecutionId()];
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  private truncateChangelog(changelog: string[], compareUrl: string) {
    return [...changelog.slice(0, MAX_NUMBER_OF_COMMITS_TO_SHOW - 1), `<${compareUrl}|And more...>`].join("\n");
  }

  private getChangelogText(changelog: string[], compareUrl: string): string {
    if (changelog.length === 0) return "No code change";

    return changelog.length <= MAX_NUMBER_OF_COMMITS_TO_SHOW
      ? changelog.join("\n")
      : this.truncateChangelog(changelog, compareUrl);
  }

  private async getFirstSlackMessageData(): Promise<NewWorkflowItem | undefined> {
    const github = new GithubWrapper(this.repo);

    const commitSha = await this.getExecutionCommitSha(github);
    const baseCommit = await this.getLatestDeployedCommitSha();
    const { changelog, compareUrl, totalCommits } = await github.compareCommits(baseCommit, commitSha);

    const { title, url } = this.getExecutionUrl();
    const executionId = await this.getExecutionId();

    return {
      isSaved: false,
      executionId,
      messageDetails: {
        // pretext: `<${url}|${title}>`,
        text: this.getChangelogText(changelog, compareUrl),
        footer: [
          ...(totalCommits > 0
            ? [`<${compareUrl}|${totalCommits} new ${totalCommits > 1 ? "commits" : "commit"}>`]
            : []),
          `<${url}|${title}>`,
        ].join(" | "),
      },
    };
  }
}
