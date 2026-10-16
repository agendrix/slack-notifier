import * as Slack from "../../../lambda/slack";

export type FakeSlackCall = {
  method: string;
  options: any;
  ts: string;
};

export type FakeSlackMessage = {
  ts: string;
  channel: string;
  text?: string;
  attachments?: any[];
  metadata?: { event_type: string; event_payload: any };
  thread_ts?: string;
};

export const KNOWN_SLACK_USER = { email: "known@agendrix.com", id: "U0KNOWN" };

let slackCalls: FakeSlackCall[] = [];
let slackMessages: FakeSlackMessage[] = [];
let lastTs = 0;
let pendingConcurrentPost: Omit<FakeSlackMessage, "ts"> | undefined;
let updatesToDrop = 0;
let staleOverwrite: ((payload: any) => any) | undefined;
let isStaleOverwriteArmed = false;

const nextTs = () => {
  lastTs = Math.max(lastTs + 1, Date.now());
  return lastTs.toString();
};

const findMessage = (ts: string) => slackMessages.find(message => message.ts === ts);

const handlers: { [method: string]: (options: any) => any } = {
  "chat.postMessage": options => {
    if (pendingConcurrentPost) {
      slackMessages.push({ ...pendingConcurrentPost, ts: nextTs() });
      pendingConcurrentPost = undefined;
    }
    const ts = nextTs();
    slackMessages.push({ ...options, ts });
    return { channel: options.channel, ts };
  },
  "chat.update": options => {
    if (updatesToDrop > 0) {
      updatesToDrop--;
      return { channel: options.channel, ts: options.ts };
    }
    const message = findMessage(options.ts);
    if (message) Object.assign(message, options);
    if (staleOverwrite) isStaleOverwriteArmed = true;
    return { channel: options.channel, ts: options.ts };
  },
  "chat.delete": options => {
    slackMessages = slackMessages.filter(message => message.ts !== options.ts);
    return { channel: options.channel, ts: options.ts };
  },
  "conversations.history": options => {
    const messages = slackMessages
      .filter(message => message.channel === options.channel && !message.thread_ts)
      .map(message =>
        options.include_all_metadata ? JSON.parse(JSON.stringify(message)) : { ...message, metadata: undefined }
      )
      .reverse();
    if (isStaleOverwriteArmed && staleOverwrite) {
      const toStalePayload = staleOverwrite;
      slackMessages
        .filter(message => message.metadata)
        .forEach(message => (message.metadata!.event_payload = toStalePayload(message.metadata!.event_payload)));
      staleOverwrite = undefined;
      isStaleOverwriteArmed = false;
    }
    return { messages };
  },
  "users.lookupByEmail": options => {
    if (options.email !== KNOWN_SLACK_USER.email) throw "users_not_found";
    return { user: { id: KNOWN_SLACK_USER.id } };
  },
};

(Slack.callApi as any) = async (method: string, options: any): Promise<any> => {
  const handler = handlers[method];
  const response = handler ? handler(options) : { channel: options.channel, ts: nextTs() };
  slackCalls.push({ method, options, ts: response.ts });
  return response;
};

export function seedSlackMessage(message: Omit<FakeSlackMessage, "ts">): FakeSlackMessage {
  const seeded = { ...message, ts: nextTs() };
  slackMessages.push(seeded);
  return seeded;
}

export function simulateConcurrentPost(message: Omit<FakeSlackMessage, "ts">) {
  pendingConcurrentPost = message;
}

export function dropNextUpdates(count: number) {
  updatesToDrop = count;
}

export function overwriteAfterNextCheck(toStalePayload: (payload: any) => any) {
  staleOverwrite = toStalePayload;
}

export function getSlackMessages(): FakeSlackMessage[] {
  return [...slackMessages];
}

export function resetFakeSlack() {
  slackCalls = [];
  slackMessages = [];
  pendingConcurrentPost = undefined;
  updatesToDrop = 0;
  staleOverwrite = undefined;
  isStaleOverwriteArmed = false;
}

export async function withFakeSlack(functionToCall: () => Promise<void>): Promise<FakeSlackCall[]> {
  slackCalls = [];
  await functionToCall();
  const calls = [...slackCalls];
  slackCalls = [];
  return calls;
}
