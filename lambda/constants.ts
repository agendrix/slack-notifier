export enum WorkflowState {
  started = "started",
  preMigration = "preMigration",
  deploying = "deploying",
  waitingForStabilization = "waitingForStabilization",
  postMigration = "postMigration",
  finished = "finished",
  stopped = "stopped",
  failed = "failed",
}

export const COLORS = {
  normal: "#888888",
  info: "#28A0F0",
  success: "#45CC88",
  warning: "#F1C45E",
  error: "#FF676A",
  slackGood: "good",
  slackDanger: "danger",
  slackWarning: "warning",
};
