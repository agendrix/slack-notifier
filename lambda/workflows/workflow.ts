import { WorkflowState } from "../constants";
import { GithubWrapper, CommitComparison } from "../github";
import * as aws from "../aws";

const MAX_NUMBER_OF_COMMITS_TO_SHOW = 40;

export type ExecutionUrl = { url: string; title: string };
export type ExecutionData = { commitSha: string; executionId: string };

export abstract class Workflow<SupportedEvent> {
  constructor(protected event: SupportedEvent, protected repo: Repo) {}
  abstract getExecutionUrl(): ExecutionUrl;
  abstract getExecutionState(): WorkflowState | undefined;
  abstract async getExecutionId(): Promise<string>;
  abstract async getExecutionCommitSha(github: GithubWrapper): Promise<string>;
  abstract async getLatestDeployedCommitSha(): Promise<string | undefined>;

  async getSlackMessageData(): Promise<S3SavedPipeline | undefined> {
    if (this.getExecutionState() === WorkflowState.started) {
      return this.getFirstSlackMessageData();
    }

    try {
      const pipelines = await aws.loadPipelines();
      return pipelines[await this.getExecutionId()];
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  private truncateChangelog(changelog: string[], compareUrl: string) {
    return [...changelog.slice(0, MAX_NUMBER_OF_COMMITS_TO_SHOW - 1), `<${compareUrl}|And more...>`].join("\n");
  }

  private getChangelogText({
    changelog,
    totalCommits,
    compareUrl,
  }: CommitComparison): { text: string; footer?: string } {
    if (changelog.length === 0) return { text: "No code change" };

    return {
      text:
        changelog.length <= MAX_NUMBER_OF_COMMITS_TO_SHOW
          ? changelog.join("\n")
          : this.truncateChangelog(changelog, compareUrl),
      footer: `<${compareUrl}|${totalCommits} new ${totalCommits > 1 ? "commits" : "commit"}>`,
    };
  }

  private async getFirstSlackMessageData(): Promise<S3SavedPipeline | undefined> {
    const github = new GithubWrapper(this.repo);

    const commitSha = await this.getExecutionCommitSha(github);
    const baseCommit = await this.getLatestDeployedCommitSha();
    const comparison = await github.compareCommits(baseCommit, commitSha);

    const { title, url } = this.getExecutionUrl();
    const executionId = await this.getExecutionId();
    const sha = await github.getHeadCommit();

    return {
      executionId,
      messageDetails: {
        ts: Date.now(),
        pretext: `<${url}|${title}> SHA: ${sha}`,
        ...this.getChangelogText(comparison),
      },
    };
  }
}
