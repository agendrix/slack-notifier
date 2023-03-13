# Ping Slack

Send a deployment notification state update to Slack.

See [action.yml](./action.yml) for the list of `inputs`.

## Example usage

```yaml
jobs:
  build:
    name: Build app
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Ping Slack
        uses: agendrix/slack-notifier/ping-slack@v1.0.2
        with:
          state: "STARTED"
          lambda-url: ${{ secrets.SLACK_LAMBDA_ENDPOINT }}
          api-secret: ${{ secrets.SLACK_API_SECRET }}
          previous-sha: ${{ env.YOUR_PREVIOUS_SHA }}

  deploy:
    name: Deploy app
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Ping Slack
        uses: agendrix/slack-notifier/ping-slack@v1.0.2
        with:
          state: "DEPLOYING"
          lambda-url: ${{ secrets.SLACK_LAMBDA_ENDPOINT }}
          api-secret: ${{ secrets.SLACK_API_SECRET }}

  notify-slack:
    name: Notify Outcome to Slack
    runs-on: ubuntu-latest
    if: always()
    needs: [build, deploy]
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - if: ${{ !contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled') }}
        name: Ping Slack for success
        uses: agendrix/slack-notifier/ping-slack@v1.0.2
        with:
          state: "SUCCEEDED"
          lambda-url: ${{ secrets.SLACK_LAMBDA_ENDPOINT }}
          api-secret: ${{ secrets.SLACK_API_SECRET }}

      - if: ${{ contains(needs.*.result, 'failure') }}
        name: Ping Slack for failure
        uses: agendrix/slack-notifier/ping-slack@v1.0.2
        with:
          state: "FAILED"
          lambda-url: ${{ secrets.SLACK_LAMBDA_ENDPOINT }}
          api-secret: ${{ secrets.SLACK_API_SECRET }}

      - if: ${{ contains(needs.*.result, 'cancelled') && !contains(needs.*.result, 'failure') }}
        name: Ping Slack for failure
        uses: agendrix/slack-notifier/ping-slack@v1.0.2
        with:
          state: "STOPPED"
          lambda-url: ${{ secrets.SLACK_LAMBDA_ENDPOINT }}
          api-secret: ${{ secrets.SLACK_API_SECRET }}
```
