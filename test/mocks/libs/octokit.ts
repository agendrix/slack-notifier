import * as Octokit from "@octokit/rest";
import { mock } from "./constants";

class MockOctokit {
  public repos = new MockRepos();
}

export class MockRepos {
  async getBranch() {
    return {
      status: 200,
      data: { commit: { sha: mock.commits.head.ref } },
    };
  }
  async compareCommits() {
    return {
      status: 200,
      data: {
        commits: [mock.commits.intermediate, mock.commits.head],
        base_commit: mock.commits.base,
        total_commits: 1,
        html_url: `https://github.com/${mock.commits.base.ref}..${mock.commits.head.ref}`,
      },
    };
  }
}

(Octokit.Octokit as any) = MockOctokit;
