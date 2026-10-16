import { mock } from "./libs/constants";

process.env.ENV = "testing";

process.env.REPO = JSON.stringify(mock.repo);
process.env.SLACK_CONFIG = JSON.stringify(mock.slackConfig);
process.env.CODEPIPELINE_CONFIG = JSON.stringify(mock.codepipelineConfig);
process.env.S3_CONFIG = JSON.stringify(mock.s3Config);
process.env.API_SECRET = mock.apiSecret;
process.env.SETTLE_DELAY_MS = "0";

import "./libs/aws-sdk";
import "./libs/octokit";
import "./libs/slack";
