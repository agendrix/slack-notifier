/// <reference path="../lambda/definitions/app.d.ts" />

import { post, RequestCallback, Response } from "request";
import * as core from "@actions/core";
import * as github from "@actions/github";

const state = core.getInput("state", { required: true }) as GithubActionsEventState;
const lambdaUrl = core.getInput("lambda-url", { required: true });
const bearerToken = core.getInput("api-secret", { required: true });
const previousSha = core.getInput("previous-sha");

async function postRequest(json: object) {
  return new Promise<Response>((resolve, reject) => {
    const callBack: RequestCallback = (error, response) => {
      if (error) return reject(error);
      return resolve(response);
    };

    post(
      lambdaUrl,
      {
        json,
        headers: {
          "Authorization": `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
      },
      callBack
    );
  });
}

async function run() {
  let payload: GitHubActionsEvent = {
    source: "github.actions",
    state,
    githubRunId: github.context.runId.toString(),
    githubSha: github.context.sha,
  };

  if (previousSha) {
    payload = { ...payload, previousSha };
  }

  console.log(`Sending state "${payload.state}"`);
  const response = await postRequest(payload);
  console.log(`Got response ${response.statusCode}:`, response.body || "No Content");
}

run();
