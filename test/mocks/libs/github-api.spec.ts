import { MockRepo } from "./github-api";
import assert from "assert";
import GitHub from "github-api";

describe("Mock github-api", () => {
  it("mock getRepo", async () => {
    const gh = new GitHub();
    const repo = gh.getRepo();
    const mockRepo = new MockRepo();
    assert.deepStrictEqual(await repo.getRef(), await mockRepo.getRef());
    assert.deepStrictEqual(await repo.compareBranches(), await mockRepo.compareBranches("", ""));
  });
});
