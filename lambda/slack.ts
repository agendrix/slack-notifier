import request from "request";
import { SLACK_CONFIG } from "./env";

/** Slack ignores JSON bodies on methods whose reference page does not list `application/json` as a content type. */
const FORM_ENCODED_METHODS = new Set(["users.lookupByEmail"]);

export function buildRequest(method: string, options: any): request.UrlOptions & request.CoreOptions {
  const url = `https://slack.com/api/${method}`;
  const headers = { Authorization: `Bearer ${SLACK_CONFIG.accessToken}` };

  if (FORM_ENCODED_METHODS.has(method)) {
    return { url, method: "POST", headers, form: options, json: true };
  }
  return { url, method: "POST", headers: { ...headers, "Content-Type": "application/json" }, json: options };
}

export async function callApi(method: string, options: any): Promise<any> {
  const slackRequest = buildRequest(method, options);

  return new Promise(function (resolve, reject) {
    request(slackRequest, function (error, _res, body) {
      if (!error && body.ok) {
        resolve(body);
      } else {
        reject(`Error while calling "${slackRequest.url}":\n${error || JSON.stringify(body)}`);
      }
    });
  });
}
