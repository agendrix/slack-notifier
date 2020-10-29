/// <reference path="../../../lambda/definitions/app.d.ts" />

import codePipelineStarted from "../events/codePipelineStarted.json";

type MockedCommit = {
  ref: string;
  commit: {
    message: string;
    author: {
      name: string;
    };
  };
  html_url: string;
};

type Mock = {
  commits: { head: MockedCommit; intermediate: MockedCommit; base: MockedCommit };
  ecrRefRepository: string;
  pipelineName: string;
  repo: Repo;
  slackChannel: string;
  apiSecret: string;
};

const mockCommit = (id: string, ref: string): MockedCommit => ({
  ref,
  commit: {
    message: `Mock of ${id} commit`,
    author: {
      name: `${id} author`,
    },
  },
  html_url: `https://${ref}`,
});

export const mock: Mock = {
  commits: {
    head: mockCommit("Head", "266db80b3e2f1bdeb69ab403ff939da49c3daca3"),
    intermediate: mockCommit("Intermediate", "bddfb38c246a869c8028b75de099e9afa6ab68e1"),
    base: mockCommit("Base", "27ff5dc5853918edd19c0522f04ea0f3bf3eb3f4"),
  },
  ecrRefRepository: "mockEcrRefRepository",
  pipelineName: codePipelineStarted.detail.pipeline,
  repo: {
    branch: "MockBranch",
    name: "MockRepo",
    owner: "MockOwner",
  },
  slackChannel: "MockSlackChannel",
  apiSecret: "38ecad74-test-test-test-1d066a531185",
};
