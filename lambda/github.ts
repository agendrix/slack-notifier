import GitHub from "github-api";
import { GitGetRefResponseData, OctokitResponse, ReposCompareCommitsResponseData } from "@octokit/types";
import { GITHUB_TOKEN } from "./env";

export type CommitComparison = {
  authorName: string;
  changelog: string[];
  totalCommits: number;
  compareUrl: string;
};

export class GithubWrapper {
  private repo: any;

  constructor(private repoInfo: Repo) {
    const gh = new GitHub({ token: GITHUB_TOKEN });
    this.repo = gh.getRepo(repoInfo.owner, repoInfo.name);
  }

  async getHeadCommit(): Promise<string> {
    const ref: OctokitResponse<GitGetRefResponseData> = await this.repo.getRef(`heads/${this.repoInfo.branch}`);
    if (ref.status !== 200) {
      throw new Error(
        `Error while fetching latest commit on branch ${this.repoInfo.branch} from ${this.repoInfo.owner}/${this.repoInfo.name}.`
      );
    }

    const sha = ref.data.object.sha;
    if (!sha) throw new Error(`Head commit not found.\nEvent:\n${JSON.stringify(event)}`);
    return sha;
  }

  async compareCommits(base: string | undefined, head: string): Promise<CommitComparison> {
    const compare: OctokitResponse<ReposCompareCommitsResponseData> = await this.repo.compareBranches(
      base || head,
      head
    );
    if (compare.status !== 200) {
      throw new Error(`Error while fetching changelog from GitHub (${base}...${head}).`);
    }

    const refCommit =
      compare.data.commits.length === 0
        ? compare.data.base_commit
        : compare.data.commits[compare.data.commits.length - 1];
    const authorName: string = refCommit.commit.author.name;

    const changelog = compare.data.commits.map(commit => {
      const commitMessage = commit.commit.message.split("\n")[0];
      const cleanedMessaged = this.replace(this.replace(commitMessage, "<", "«"), ">", "»");
      const commitUrl = commit.html_url;
      return `<${commitUrl}|${cleanedMessaged}>`;
    });

    return {
      authorName,
      changelog,
      totalCommits: compare.data.total_commits,
      compareUrl: compare.data.html_url,
    };
  }

  private replace(str: string, search: string, replacement: string) {
    return str.split(search).join(replacement);
  }
}
