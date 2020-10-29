# Slack Notifier

_An AWS Lambda for sending deployment updates to Slack._
_Supports GitHub Actions and CodePipeline deployments._

![Tests](https://github.com/agendrix/slack-notifier/workflows/Tests/badge.svg?branch=main)

This small Lambda app will post updates to a Slack channel for pipeline events generated by AWS Code Pipeline and Code Deploy.

## Publish a new version

```bash
cd modules/codepipeline/slack-notifier/aws-lambda
yarn
yarn dist
```

This will generates a new version of [`target/lambda.zip`](target/lambda.zip).

Then, you can deploy the new version with `terraform`.

## Testing

If you'd like to test the app, you can configure the test events from the [`test/mocks`](test/mocks) folder in the AWS Lambda console, and test there.

### Locally run the tests

```bash
yarn
yarn test
```
