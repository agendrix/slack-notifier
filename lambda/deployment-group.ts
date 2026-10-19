import * as slack from "./slack";
import { COLORS } from "./constants";
import { ENV, REPO, SETTLE_DELAY_MS, SLACK_CONFIG } from "./env";
import { GithubWrapper } from "./github";

const EVENT_TYPE = "deployment_group";
const SHORT_SHA_LENGTH = 7;
const MAX_COMMITS_TO_SHOW = 5;
const MAX_UPDATE_ATTEMPTS = 3;
const HISTORY_LIMIT = 100;
const TIME_ZONE = "America/Toronto";

type EnvironmentState = {
  state: GithubActionsEventState;
  failedStep?: string;
  at: number;
  runUrl: string;
};

type ReleaseState = {
  state: "pending" | "published" | "skipped" | "failed";
  name?: string;
  url?: string;
  runUrl?: string;
};

export type DeploymentGroupPayload = {
  key: string;
  sha: string;
  group: DeploymentGroup;
  initiator?: string;
  changelog: string[];
  totalCommits: number;
  compareUrl: string;
  replacedBy?: string;
  release?: ReleaseState;
  envs: { [environment: string]: EnvironmentState };
};

type GroupMessage = { ts: string; payload: DeploymentGroupPayload };

type GroupStatus = "inProgress" | "succeeded" | "failed" | "skipped";

const COLORS_BY_STATUS: { [k in GroupStatus]: string } = {
  inProgress: COLORS.warning,
  succeeded: COLORS.success,
  failed: COLORS.error,
  skipped: COLORS.normal,
};

const STEP_LABELS: { [k in GithubActionsEventState]?: string } = {
  STARTED: "Started",
  PRE_MIGRATIONS: "Pre-migrations",
  DEPLOYING: "Deploying",
  POST_MIGRATIONS: "Post-migrations",
};

const FAILED_STEP_LABELS: { [k in GithubActionsEventState]?: string } = { ...STEP_LABELS, STARTED: "Build" };

const ENDING_STATES: GithubActionsEventState[] = ["SUCCEEDED", "FAILED", "STOPPED", "SKIPPED"];

/** The team follows production deploys; the other groups only show up in Slack when one of their deploys fails. */
const isQuietGroup = (group: DeploymentGroup) => group !== "production";

const RELEASE_STATES: { [k in GithubActionsEventState]?: ReleaseState["state"] } = {
  RELEASE_PUBLISHED: "published",
  RELEASE_SKIPPED: "skipped",
  RELEASE_FAILED: "failed",
};

const shortSha = (sha: string) => sha.substr(0, SHORT_SHA_LENGTH);
const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const formatTime = (at: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(at));

const getRunUrl = (event: GitHubActionsEvent) =>
  `https://github.com/${REPO.owner}/${REPO.name}/actions/runs/${event.githubRunId}`;

const getGroupKey = (event: GitHubActionsEvent) => `${REPO.owner}/${REPO.name}/${event.githubSha}/${event.group}`;

async function listGroupMessages(): Promise<GroupMessage[]> {
  const history = await slack.callApi("conversations.history", {
    channel: SLACK_CONFIG.channel,
    limit: HISTORY_LIMIT,
    include_all_metadata: true,
  });

  return (history.messages || [])
    .filter((message: any) => message.metadata?.event_type === EVENT_TYPE)
    .map((message: any) => ({ ts: message.ts, payload: message.metadata.event_payload }))
    .sort((a: GroupMessage, b: GroupMessage) => parseFloat(a.ts) - parseFloat(b.ts));
}

async function findGroupMessage(key: string): Promise<GroupMessage | undefined> {
  return (await listGroupMessages()).find(message => message.payload.key === key);
}

const waitForOtherWriters = () => new Promise(resolve => setTimeout(resolve, SETTLE_DELAY_MS * (0.5 + Math.random())));

async function findReplacingSha(message: GroupMessage): Promise<string | undefined> {
  const newer = (await listGroupMessages()).find(
    other =>
      other.payload.group === message.payload.group &&
      other.payload.key !== message.payload.key &&
      parseFloat(other.ts) > parseFloat(message.ts)
  );
  return newer?.payload.sha;
}

async function createGroupMessage(event: GitHubActionsEvent, key: string): Promise<GroupMessage> {
  const github = new GithubWrapper(REPO);
  const { changelog, totalCommits, compareUrl } = await github.compareCommits(event.previousSha, event.githubSha);

  const payload: DeploymentGroupPayload = {
    key,
    sha: event.githubSha,
    group: event.group!,
    initiator: event.initiator,
    changelog: changelog.slice(0, MAX_COMMITS_TO_SHOW),
    totalCommits,
    compareUrl,
    ...(event.group === "production" ? { release: { state: "pending" } } : {}),
    envs: {},
  };

  const posted = await slack.callApi("chat.postMessage", {
    channel: SLACK_CONFIG.channel,
    ...renderGroupMessage(payload),
  });

  const earliest = await findGroupMessage(key);
  if (earliest && earliest.ts !== posted.ts) {
    await slack.callApi("chat.delete", { channel: SLACK_CONFIG.channel, ts: posted.ts });
    return earliest;
  }

  return { ts: posted.ts, payload };
}

function buildChange(
  event: GitHubActionsEvent,
  failedStep: string | undefined,
  replacedBy: string | undefined
): (payload: DeploymentGroupPayload) => DeploymentGroupPayload {
  const releaseState = RELEASE_STATES[event.state];
  if (releaseState) {
    const release: ReleaseState =
      releaseState === "published"
        ? { state: releaseState, name: event.releaseName, url: event.releaseUrl }
        : { state: releaseState, runUrl: getRunUrl(event) };
    return payload => ({ ...payload, release });
  }

  const environmentState: EnvironmentState = {
    state: event.state,
    at: Date.now(),
    runUrl: getRunUrl(event),
    ...(event.state === "FAILED" ? { failedStep } : {}),
  };

  return payload => ({
    ...payload,
    ...(replacedBy ? { replacedBy } : {}),
    envs: { ...payload.envs, [ENV]: environmentState },
  });
}

function isChangeSaved(saved: DeploymentGroupPayload, expected: DeploymentGroupPayload, event: GitHubActionsEvent) {
  if (RELEASE_STATES[event.state]) return saved.release?.state === expected.release?.state;

  const savedState = saved.envs[ENV];
  const expectedState = expected.envs[ENV];
  return savedState?.state === expectedState.state && savedState?.at === expectedState.at;
}

async function getMention(event: GitHubActionsEvent): Promise<string> {
  if (event.initiatorEmail) {
    try {
      const response = await slack.callApi("users.lookupByEmail", { email: event.initiatorEmail });
      return `<@${response.user.id}>`;
    } catch (error) {
      console.error(error);
    }
  }
  return event.initiator ? `@${event.initiator}` : "";
}

function renderFailureReply(event: GitHubActionsEvent, failedStep: string | undefined, mention: string): string {
  const runLink = `<${getRunUrl(event)}|Open the run>`;
  const step = failedStep ? ` at *${failedStep}*` : "";
  const reason = event.state === "RELEASE_FAILED" ? "❌ Release failed." : `❌ *${ENV}* failed${step}.`;
  return [reason, [runLink, mention].filter(Boolean).join(" · ")].join(" ");
}

async function postFailureReply(event: GitHubActionsEvent, messageTs: string, failedStep: string | undefined) {
  await slack.callApi("chat.postMessage", {
    channel: SLACK_CONFIG.channel,
    thread_ts: messageTs,
    text: renderFailureReply(event, failedStep, await getMention(event)),
  });
}

function getGroupStatus(payload: DeploymentGroupPayload): GroupStatus {
  const states = Object.values(payload.envs).map(environment => environment.state);
  if (states.some(state => state === "FAILED" || state === "STOPPED")) return "failed";
  if (states.length === 0 || states.some(state => !ENDING_STATES.includes(state))) return "inProgress";
  if (states.every(state => state === "SKIPPED")) return "skipped";
  return "succeeded";
}

function renderTitle(payload: DeploymentGroupPayload, status: GroupStatus): string {
  const environments = Object.values(payload.envs);
  const sha = `\`${shortSha(payload.sha)}\``;
  const done = environments.filter(environment => environment.state === "SUCCEEDED").length;
  const failed = environments.filter(environment => environment.state === "FAILED").length;
  const progress = `${done}/${environments.length} done${failed > 0 ? `, ${failed} failed` : ""}`;
  const isEnded =
    environments.length > 0 && environments.every(environment => ENDING_STATES.includes(environment.state));

  if (status === "skipped") {
    const reason = payload.replacedBy ? `replaced by \`${shortSha(payload.replacedBy)}\`` : "nothing to deploy";
    return `⏭️ Skipped ${sha} on *${payload.group}* · ${reason}`;
  }
  if (!isEnded) return `:loading_fast: Deploying ${sha} to *${payload.group}* · ${progress}`;
  return `${status === "failed" ? "❌" : "✅"} Deployed ${sha} to *${payload.group}* · ${progress}`;
}

function renderEnvironment(name: string, environment: EnvironmentState): string {
  const run = `<${environment.runUrl}|run>`;
  const time = formatTime(environment.at);
  const lines: { [k in GithubActionsEventState]?: string } = {
    SUCCEEDED: `✅ *${name}* · Finished ${time}`,
    FAILED: `❌ *${name}* · Failed${environment.failedStep ? ` at ${environment.failedStep}` : ""} ${time}`,
    STOPPED: `⏹️ *${name}* · Stopped ${time}`,
    SKIPPED: `⏭️ *${name}* · Skipped ${time}`,
  };
  const line = lines[environment.state] || `:loading_fast: *${name}* · ${STEP_LABELS[environment.state]} ${time}`;
  return `${line} · ${run}`;
}

function renderRelease(release: ReleaseState): string {
  const lines: { [k in ReleaseState["state"]]: string } = {
    pending: "📦 Release pending",
    published: `📦 Release <${release.url}|*${release.name}*>`,
    skipped: "📦 No new release",
    failed: `📦 Release failed · <${release.runUrl}|Open the run>`,
  };
  return lines[release.state];
}

function renderCommitsLink(payload: DeploymentGroupPayload, isListed: boolean): string {
  if (payload.totalCommits === 0) return "No code change";
  if (!isListed) return `<${payload.compareUrl}|${pluralize(payload.totalCommits, "commit")}>`;
  if (payload.totalCommits > payload.changelog.length) {
    return `<${payload.compareUrl}|+${payload.totalCommits - payload.changelog.length} more>`;
  }
  return `<${payload.compareUrl}|${pluralize(payload.totalCommits, "new commit")}>`;
}

function renderGroupMessage(payload: DeploymentGroupPayload) {
  const status = getGroupStatus(payload);
  const isCommitListed = payload.release?.state !== "published";
  const initiatorLabel = payload.group === "production" ? "launched by" : "merged by";
  const context = [
    renderCommitsLink(payload, isCommitListed),
    ...(payload.initiator ? [`${initiatorLabel} @${payload.initiator}`] : []),
  ].join(" · ");

  const lines = [
    ...(isCommitListed ? payload.changelog : []),
    context,
    ...(payload.release ? [renderRelease(payload.release)] : []),
    ...Object.keys(payload.envs)
      .sort()
      .map(name => renderEnvironment(name, payload.envs[name])),
  ];

  return {
    text: renderTitle(payload, status),
    attachments: [{ color: COLORS_BY_STATUS[status], text: lines.join("\n"), mrkdwn_in: ["text"] }],
    metadata: { event_type: EVENT_TYPE, event_payload: payload },
  };
}

export function isDeploymentGroupEvent(event: GitHubActionsEvent): boolean {
  return !!event.group;
}

export async function handleDeploymentGroupEvent(event: GitHubActionsEvent): Promise<void> {
  const key = getGroupKey(event);
  const existing = await findGroupMessage(key);
  const isQuiet = isQuietGroup(event.group!);
  if (!existing && isQuiet && event.state !== "FAILED") return;

  let message = existing || (await createGroupMessage(event, key));
  const previous = message.payload.envs[ENV];
  // A quiet group keeps no message before its first failure, so the step that failed is unknown there.
  const failedStep = previous || !isQuiet ? FAILED_STEP_LABELS[previous?.state || "STARTED"] : undefined;
  const replacedBy = event.state === "SKIPPED" ? await findReplacingSha(message) : undefined;
  const applyChange = buildChange(event, failedStep, replacedBy);

  for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt++) {
    const payload = applyChange(message.payload);
    await slack.callApi("chat.update", {
      channel: SLACK_CONFIG.channel,
      ts: message.ts,
      ...renderGroupMessage(payload),
    });

    let saved = await findGroupMessage(key);
    // Slack has no conditional update: an environment that read the message before this write can still overwrite it.
    if (saved && isChangeSaved(saved.payload, payload, event)) {
      await waitForOtherWriters();
      saved = await findGroupMessage(key);
    }
    if (!saved || isChangeSaved(saved.payload, payload, event)) break;
    message = saved;
  }

  const isNewEnvironmentFailure = event.state === "FAILED" && previous?.state !== "FAILED";
  if (isNewEnvironmentFailure || event.state === "RELEASE_FAILED") {
    await postFailureReply(event, message.ts, failedStep);
  }
}

export const __test__ = {
  renderGroupMessage,
  renderFailureReply,
  COLORS_BY_STATUS,
};
