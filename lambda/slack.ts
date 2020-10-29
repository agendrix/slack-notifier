import request from "request";
import { SLACK_ACCESS_TOKEN } from "./env";

export async function callApi(method: string, options: any): Promise<any> {
  const url = `https://slack.com/api/${method}`;
  const slackRequest: request.UrlOptions & request.CoreOptions = {
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SLACK_ACCESS_TOKEN}`
    },
    json: options
  };

  return new Promise(function(resolve, reject) {
    request(slackRequest, function(error, res, body) {
      if (!error && res.statusCode == 200) {
        if (body.ok) {
          resolve(body);
        } else {
          reject(`Error while calling "${url}":\n${body}`);
        }
      } else {
        reject(`Error while calling "${url}":\n${error}`);
      }
    });
  });
}
