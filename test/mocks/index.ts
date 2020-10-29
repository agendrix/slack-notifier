import { mock } from "./libs/constants";

process.env.ENV = "testing";

process.env.REPO = JSON.stringify(mock.repo);
process.env.SLACK_CHANNEL = mock.slackChannel;
process.env.ECR_REF_REPOSITORY = mock.ecrRefRepository;
process.env.PIPELINE_NAME = mock.pipelineName;
process.env.API_SECRET = mock.apiSecret;

import "./libs/aws-sdk";
import "./libs/github-api";
import "./libs/slack";
