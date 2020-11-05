import { MockRepos } from "./octokit";
import assert from "assert";
import { Octokit } from "@octokit/rest";

describe("Mock github-api", () => {
  it("mock getBranch", async () => {
    const octokit = new Octokit();
    const mockRepos = new MockRepos();
    assert.deepStrictEqual(await octokit.repos.getBranch(), await mockRepos.getBranch());
  });

  it("mock compareCommits", async () => {
    const octokit = new Octokit();
    const mockRepos = new MockRepos();
    assert.deepStrictEqual(await octokit.repos.compareCommits(), await mockRepos.compareCommits());
  });
});
