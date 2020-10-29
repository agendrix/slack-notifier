import { PipelineState } from "../constants";
import { GithubWrapper } from "../github";
import * as aws from "../aws";

export type ExecutionUrl = { url: string; title: string };
export type ExecutionData = { commitSha: string; executionId: string };

export abstract class Workflow<SupportedEvent> {
  constructor(protected event: SupportedEvent, protected repo: Repo) {}
  abstract getExecutionUrl(): ExecutionUrl;
  abstract getExecutionState(): PipelineState | undefined;
  abstract async getExecutionId(): Promise<string>;
  abstract async getExecutionCommitSha(github: GithubWrapper): Promise<string>;
  abstract async getLatestDeployedCommitSha(): Promise<string | undefined>;

  async getSlackMessageData(): Promise<S3SavedPipeline | undefined> {
    if (this.getExecutionState() === PipelineState.started) {
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

  private async getFirstSlackMessageData(): Promise<S3SavedPipeline | undefined> {
    const github = new GithubWrapper(this.repo);

    const commitSha = await this.getExecutionCommitSha(github);
    const baseCommit = await this.getLatestDeployedCommitSha();
    const { changelog, totalCommits, compareUrl } = await github.compareCommits(baseCommit, commitSha);

    const { title, url } = this.getExecutionUrl();
    const executionId = await this.getExecutionId();

    return {
      executionId,
      messageDetails: {
        ts: Date.now(),
        pretext: `<${url}|${title}>`,
        ...(changelog.length > 0
          ? {
              text:
                changelog.length <= 40
                  ? changelog.join("\n")
                  : [...changelog.slice(0, 39), `<${compareUrl}|And more...>`].join("\n"),
              footer: `<${compareUrl}|${totalCommits} new ${totalCommits > 1 ? "commits" : "commit"}>`,
            }
          : { text: "No code change" }),
      },
    };
  }
}
