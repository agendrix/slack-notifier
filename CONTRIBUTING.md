# Contributing

## Publish a new version

```bash
yarn install
yarn dist
```

This will build a new version of the AWS lambda function at [`terraform/lambda.zip`](terraform/lambda.zip).

## Testing

If you'd like to test the app, you can configure the test events from the [`test/mocks`](test/mocks) folder in the AWS Lambda console, and test there.

### Locally run the tests

```bash
yarn install
yarn test
```
