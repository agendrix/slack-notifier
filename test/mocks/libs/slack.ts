import * as Slack from "../../../lambda/slack";

export type FakeSlackCall = {
  method: string;
  options: any;
  ts: string;
};

let slackCalls: FakeSlackCall[] = [];

(Slack.callApi as any) = async (method: string, options: any): Promise<any> => {
  const ts = Date.now().toString();
  slackCalls.push({ method, options, ts });
  return { channel: options.channel, ts };
};

export async function withFakeSlack(functionToCall: () => Promise<void>): Promise<FakeSlackCall[]> {
  slackCalls = [];
  await functionToCall();
  const calls = [...slackCalls];
  slackCalls = [];
  return calls;
}
