import { GITHUB_TOKEN } from "./env";
import { Octokit } from "@octokit/rest";

const SHORT_SHA_LENGTH = 7;

type CommitComparison = {
  authorName: string;
  changelog: string[];
  totalCommits: number;
  compareUrl: string;
};

export class GithubWrapper {
  private octokit: Octokit;

  constructor(private repo: Repo) {
    this.octokit = new Octokit({ auth: GITHUB_TOKEN });
  }

  async getHeadCommit(branchName: string): Promise<string> {
    const branch = await this.octokit.repos.getBranch({
      branch: branchName,
      repo: this.repo.name,
      owner: this.repo.owner,
    });

    if (branch.status !== 200) {
      throw this.makeError(`Error while fetching latest commit on branch ${branchName}`);
    }

    return branch.data.commit.sha;
  }

  async compareCommits(base: string | undefined, head: string): Promise<CommitComparison> {
    const compare = await this.octokit.repos.compareCommits({
      base: (base || head).substr(0, SHORT_SHA_LENGTH),
      head: head.substr(0, SHORT_SHA_LENGTH),
      owner: this.repo.owner,
      repo: this.repo.name,
    });

    if (compare.status !== 200) {
      throw this.makeError(`Error while fetching changelog from GitHub (${base}...${head}).`);
    }

    const refCommit =
      compare.data.commits.length === 0
        ? compare.data.base_commit
        : compare.data.commits[compare.data.commits.length - 1];
    const authorName: string = refCommit.commit.author.name;

    const changelog = compare.data.commits.map(commit => {
      const commitMessage = commit.commit.message.split("\n")[0];
      const cleanedMessaged = commitMessage.replace(/</g, "«").replace(/>/g, "»");
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

  private makeError(message: string) {
    return new Error(`${message}\nRepo: ${this.repo.owner}/${this.repo.name}`);
  }
}
