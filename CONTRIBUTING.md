# Contributing

## Publish a new release

- [Create a new release](https://github.com/agendrix/slack-notifier/releases/new)
- Check `This is a pre-release`
- A GitHub workflow will run and build the code and update the release.
- Once the build is completed, publish the release.

## Testing

If you'd like to test the app, you can configure the test events from the [`test/mocks`](test/mocks) folder in the AWS Lambda console, and test there.

### Locally run the tests

```bash
yarn install
yarn test
```
