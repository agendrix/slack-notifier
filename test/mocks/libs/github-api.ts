import GitHub from "github-api";
import { mock } from "./constants";

export class MockRepo {
  async getRef() {
    return {
      status: 200,
      data: { object: { sha: mock.commits.head.ref } },
    };
  }
  async compareBranches(_base: string, _head: string) {
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

GitHub.prototype.getRepo = () => new MockRepo();
