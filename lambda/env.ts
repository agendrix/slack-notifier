export const ENV = process.env.ENV as string;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN as string;
export const REPO = JSON.parse(process.env.REPO as string) as Repo;
export const SLACK_CONFIG = JSON.parse(process.env.SLACK_CONFIG as string) as SlackConfig;
export const S3_CONFIG = JSON.parse(process.env.S3_CONFIG as string) as S3Config;
export const API_SECRET = process.env.API_SECRET as string | undefined;
export const CODEPIPELINE_CONFIG = process.env.CODEPIPELINE_CONFIG
  ? (JSON.parse(process.env.CODEPIPELINE_CONFIG) as CodepipelineConfig)
  : undefined;
